import { constants } from 'node:fs'
import { mkdir, open, readFile, rm } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { cpus } from 'node:os'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { cleanupValidationProcessTree } from './validation-process-tree-cleanup.mjs'

const minimumTimeoutMilliseconds = 1_000
const maximumTimeoutMilliseconds = 60 * 60 * 1_000
const defaultHeartbeatMilliseconds = 15_000
const defaultCpuSampleMilliseconds = 500
const defaultInterStepCooldownMilliseconds = 0
const validationPlanKeys = new Set([
	'token',
	'workingDirectory',
	'heartbeatMilliseconds',
	'maximumCpuPercent',
	'cpuSampleMilliseconds',
	'interStepCooldownMilliseconds',
	'cpuPauseMilliseconds',
	'maximumCpuPauseRetries',
	'steps'
])
const validationPlanCompositionKeys = new Set([
	...validationPlanKeys,
	'extends',
	'prependSteps',
	'appendSteps'
])
const validationStepKeys = new Set([
	'name',
	'command',
	'args',
	'timeoutMilliseconds',
	'workingDirectory'
])

function requireRecord(value, label) {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new TypeError(`${label} must be an object.`)
	}
	return value
}

function rejectUnknownKeys(value, allowed, label) {
	const unsupported = Object.keys(value).filter((key) => !allowed.has(key))
	if (unsupported.length > 0) {
		throw new TypeError(`${label} contains unsupported fields: ${unsupported.join(', ')}.`)
	}
}

function requireNonEmptyString(value, label) {
	if (typeof value !== 'string' || value.trim() === '') {
		throw new TypeError(`${label} must be a non-empty string.`)
	}
	return value
}

function requireTimeout(value, label) {
	if (
		!Number.isSafeInteger(value) ||
		value < minimumTimeoutMilliseconds ||
		value > maximumTimeoutMilliseconds
	) {
		throw new TypeError(
			`${label} must be an integer between ${minimumTimeoutMilliseconds} and ${maximumTimeoutMilliseconds}.`
		)
	}
	return value
}

function requireCpuPercent(value) {
	if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100) {
		throw new TypeError('Maximum CPU percent must be a number greater than 0 and at most 100.')
	}
	return value
}

function requireCpuSampleMilliseconds(value) {
	if (!Number.isSafeInteger(value) || value < 250 || value > 10_000) {
		throw new TypeError('CPU sample interval must be an integer between 250 and 10000.')
	}
	return value
}

function requireCpuPauseRetries(value) {
	if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
		throw new TypeError('Maximum CPU pause retries must be an integer between 1 and 100.')
	}
	return value
}

class CpuLimitReachedError extends Error {
	stepName
	observedPercent

	constructor(stepName, observedPercent) {
		super(
			`Validation paused for CPU limit: ${stepName} reached ${observedPercent.toFixed(1)}%.`
		)
		this.name = 'CpuLimitReachedError'
		this.stepName = stepName
		this.observedPercent = observedPercent
	}
}

export function readCpuTimes() {
	const processors = cpus()
	if (processors.length === 0) throw new Error('CPU usage is unavailable.')
	let idle = 0
	let total = 0
	for (const processor of processors) {
		idle += processor.times.idle
		for (const value of Object.values(processor.times)) total += value
	}
	if (!Number.isFinite(idle) || !Number.isFinite(total) || total <= 0) {
		throw new Error('CPU usage counters are invalid.')
	}
	return Object.freeze({ idle, total })
}

export function calculateCpuPercent(previous, current) {
	const totalDelta = current.total - previous.total
	const idleDelta = current.idle - previous.idle
	if (!Number.isFinite(totalDelta) || !Number.isFinite(idleDelta) || totalDelta <= 0) {
		throw new Error('CPU usage counters did not advance.')
	}
	return Math.max(0, Math.min(100, ((totalDelta - idleDelta) / totalDelta) * 100))
}

function delay(milliseconds) {
	return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

export function parsePlan(value, planDirectory) {
	const source = requireRecord(value, 'Validation plan')
	rejectUnknownKeys(source, validationPlanKeys, 'Validation plan')
	const token = requireNonEmptyString(source.token, 'Validation plan token')
	if (!/^[a-z0-9][a-z0-9-]{2,80}$/u.test(token)) {
		throw new TypeError('Validation plan token contains unsupported characters.')
	}
	const workingDirectory =
		source.workingDirectory === undefined
			? planDirectory
			: resolve(
					planDirectory,
					requireNonEmptyString(source.workingDirectory, 'Working directory')
				)
	const heartbeatMilliseconds =
		source.heartbeatMilliseconds === undefined
			? defaultHeartbeatMilliseconds
			: requireTimeout(source.heartbeatMilliseconds, 'Heartbeat interval')
	const maximumCpuPercent =
		source.maximumCpuPercent === undefined
			? undefined
			: requireCpuPercent(source.maximumCpuPercent)
	if (source.cpuSampleMilliseconds !== undefined && maximumCpuPercent === undefined) {
		throw new TypeError('CPU sample interval requires a maximum CPU percent.')
	}
	const cpuSampleMilliseconds =
		source.cpuSampleMilliseconds === undefined
			? defaultCpuSampleMilliseconds
			: requireCpuSampleMilliseconds(source.cpuSampleMilliseconds)
	const interStepCooldownMilliseconds =
		source.interStepCooldownMilliseconds === undefined
			? defaultInterStepCooldownMilliseconds
			: requireTimeout(source.interStepCooldownMilliseconds, 'Inter-step cooldown')
	const cpuPauseMilliseconds =
		source.cpuPauseMilliseconds === undefined
			? undefined
			: requireTimeout(source.cpuPauseMilliseconds, 'CPU pause')
	const maximumCpuPauseRetries =
		source.maximumCpuPauseRetries === undefined
			? undefined
			: requireCpuPauseRetries(source.maximumCpuPauseRetries)
	if ((cpuPauseMilliseconds === undefined) !== (maximumCpuPauseRetries === undefined)) {
		throw new TypeError('CPU pause and maximum CPU pause retries must be configured together.')
	}
	if (cpuPauseMilliseconds !== undefined && maximumCpuPercent === undefined) {
		throw new TypeError('CPU pause requires a maximum CPU percent.')
	}
	if (!Array.isArray(source.steps) || source.steps.length === 0) {
		throw new TypeError('Validation plan must contain at least one step.')
	}
	const steps = source.steps.map((candidate, index) => {
		const step = requireRecord(candidate, `Step ${index + 1}`)
		rejectUnknownKeys(step, validationStepKeys, `Step ${index + 1}`)
		if (!Array.isArray(step.args) || !step.args.every((arg) => typeof arg === 'string')) {
			throw new TypeError(`Step ${index + 1} args must be an array of strings.`)
		}
		return Object.freeze({
			name: requireNonEmptyString(step.name, `Step ${index + 1} name`),
			command: requireNonEmptyString(step.command, `Step ${index + 1} command`),
			args: Object.freeze([...step.args]),
			timeoutMilliseconds: requireTimeout(
				step.timeoutMilliseconds,
				`Step ${index + 1} timeout`
			),
			workingDirectory:
				step.workingDirectory === undefined
					? workingDirectory
					: resolve(
							workingDirectory,
							requireNonEmptyString(
								step.workingDirectory,
								`Step ${index + 1} working directory`
							)
						)
		})
	})
	return Object.freeze({
		token,
		workingDirectory,
		heartbeatMilliseconds,
		maximumCpuPercent,
		cpuSampleMilliseconds,
		interStepCooldownMilliseconds,
		cpuPauseMilliseconds,
		maximumCpuPauseRetries,
		steps
	})
}

async function composeValidationPlan(planPath, stack) {
	const resolvedPlanPath = resolve(planPath)
	if (stack.includes(resolvedPlanPath)) {
		throw new TypeError(
			`Validation plan inheritance contains a cycle: ${[...stack, resolvedPlanPath].join(' -> ')}.`
		)
	}
	const source = requireRecord(
		JSON.parse(await readFile(resolvedPlanPath, 'utf8')),
		`Validation plan ${resolvedPlanPath}`
	)
	rejectUnknownKeys(source, validationPlanCompositionKeys, `Validation plan ${resolvedPlanPath}`)
	if (source.extends === undefined) {
		if (source.prependSteps !== undefined || source.appendSteps !== undefined) {
			throw new TypeError('Prepend/append steps require an extended validation plan.')
		}
		return source
	}
	if (source.steps !== undefined) {
		throw new TypeError(
			'An extended validation plan must use prependSteps/appendSteps, not steps.'
		)
	}
	const derivedToken = requireNonEmptyString(source.token, 'Extended validation plan token')
	const baseArgument = requireNonEmptyString(source.extends, 'Extended validation plan path')
	const basePath = resolve(dirname(resolvedPlanPath), baseArgument)
	if (dirname(basePath) !== dirname(resolvedPlanPath)) {
		throw new TypeError('An extended validation plan must share its base plan directory.')
	}
	const prependSteps = source.prependSteps ?? []
	const appendSteps = source.appendSteps ?? []
	if (!Array.isArray(prependSteps) || !Array.isArray(appendSteps)) {
		throw new TypeError('Prepend/append steps must be arrays.')
	}
	const base = await composeValidationPlan(basePath, [...stack, resolvedPlanPath])
	const overrides = { ...source }
	delete overrides.extends
	delete overrides.prependSteps
	delete overrides.appendSteps
	return {
		...base,
		...overrides,
		token: derivedToken,
		steps: [...prependSteps, ...base.steps, ...appendSteps]
	}
}

export async function loadValidationPlan(planPath) {
	const resolvedPlanPath = resolve(planPath)
	return parsePlan(await composeValidationPlan(resolvedPlanPath, []), dirname(resolvedPlanPath))
}

export async function acquireValidationLock(lockPath, owner) {
	await mkdir(dirname(lockPath), { recursive: true })
	let lock
	try {
		lock = await open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY)
	} catch (error) {
		if (typeof error === 'object' && error !== null && error.code === 'EEXIST') {
			const existingOwner = await readFile(lockPath, 'utf8').catch(() => 'unreadable lock')
			throw new Error(
				`Validation plan is already running. Lock: ${lockPath}\n${existingOwner}`
			)
		}
		throw error
	}
	try {
		await lock.writeFile(`${JSON.stringify(owner)}\n`)
	} catch (error) {
		await lock.close().catch(() => undefined)
		await rm(lockPath, { force: true })
		throw error
	}
	let released = false
	let handleClosed = false
	return Object.freeze({
		release: async () => {
			if (released) return
			if (!handleClosed) {
				await lock.close().catch(() => undefined)
				handleClosed = true
			}
			await rm(lockPath, { force: true })
			released = true
		}
	})
}

export function createValidationInterruptionController(
	childOwner,
	writeDiagnostic = (message) => process.stderr.write(message)
) {
	let interruptedSignal = null
	return Object.freeze({
		interrupt: (signal) => {
			if (interruptedSignal !== null) return
			interruptedSignal = signal
			writeDiagnostic(`[validation] received ${signal}; terminating owned process tree.\n`)
			void childOwner.current?.requestTermination()
		},
		signal: () => interruptedSignal
	})
}

function commandFor(step) {
	return step.command === '$NODE' || step.command === '$NPM' ? process.execPath : step.command
}

function argsFor(step) {
	if (step.command !== '$NPM') return step.args
	const npmCli =
		typeof process.env.npm_execpath === 'string' && isAbsolute(process.env.npm_execpath)
			? process.env.npm_execpath
			: resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
	return [npmCli, ...step.args]
}

async function terminateOwnedProcessTree(child) {
	if (child === null || child.exitCode !== null || child.signalCode !== null) return
	const pid = child.pid
	if (!Number.isSafeInteger(pid) || pid <= 0) return
	if (process.platform === 'win32') {
		await new Promise((resolveTermination) => {
			const terminator = spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
				shell: false,
				stdio: 'ignore',
				windowsHide: true
			})
			terminator.once('error', () => resolveTermination())
			terminator.once('exit', () => resolveTermination())
		})
		return
	}
	try {
		process.kill(-pid, 'SIGTERM')
	} catch {
		return
	}
	await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000))
	try {
		process.kill(-pid, 'SIGKILL')
	} catch {
		// The task-owned process group already exited.
	}
}

async function runStep(
	step,
	index,
	total,
	heartbeatMilliseconds,
	maximumCpuPercent,
	cpuSampleMilliseconds,
	childOwner,
	interruptedSignal
) {
	const startedAt = Date.now()
	let preflightCpuPercent
	if (maximumCpuPercent !== undefined) {
		const previousCpuTimes = readCpuTimes()
		await delay(cpuSampleMilliseconds)
		const currentCpuTimes = readCpuTimes()
		preflightCpuPercent = calculateCpuPercent(previousCpuTimes, currentCpuTimes)
		if (preflightCpuPercent >= maximumCpuPercent) {
			throw new CpuLimitReachedError(step.name, preflightCpuPercent)
		}
	}
	const signalBeforeStart = interruptedSignal()
	if (signalBeforeStart !== null) {
		throw new Error(`Validation interrupted by ${signalBeforeStart}.`)
	}
	process.stdout.write(
		`[validation] step ${index + 1}/${total} started: ${step.name} (timeout ${step.timeoutMilliseconds}ms)\n`
	)
	const child = spawn(commandFor(step), argsFor(step), {
		cwd: step.workingDirectory,
		shell: false,
		stdio: 'inherit',
		windowsHide: true,
		detached: process.platform !== 'win32'
	})
	const processId = child.pid
	let exactCleanupPromise
	const exactCleanup = () => {
		if (!Number.isSafeInteger(processId) || processId <= 0) return Promise.resolve(true)
		exactCleanupPromise ??= cleanupValidationProcessTree({
			processId,
			startedAtMs: startedAt,
			cleanupStartedAtMs: Date.now()
		})
		return exactCleanupPromise
	}
	let terminationPromise
	const requestTermination = () => {
		terminationPromise ??= terminateOwnedProcessTree(child)
		return terminationPromise
	}
	childOwner.current = Object.freeze({ child, requestTermination })

	let timedOut = false
	const timeout = setTimeout(() => {
		timedOut = true
		void requestTermination()
	}, step.timeoutMilliseconds)
	const heartbeat = setInterval(() => {
		const elapsedSeconds = Math.round((Date.now() - startedAt) / 1_000)
		process.stdout.write(
			`[validation] heartbeat: ${step.name} is running (${elapsedSeconds}s, pid ${child.pid ?? 'unknown'})\n`
		)
	}, heartbeatMilliseconds)

	let stepError
	let cleanupError
	let cleanupSucceeded = false
	try {
		const outcome = await new Promise((resolveOutcome, rejectOutcome) => {
			child.once('error', rejectOutcome)
			child.once('exit', (code, signal) => resolveOutcome({ code, signal }))
		})
		if (timedOut) {
			throw new Error(`Validation step timed out: ${step.name}.`)
		}
		if (outcome.code !== 0) {
			throw new Error(
				`Validation step failed: ${step.name} (code ${String(outcome.code)}, signal ${String(outcome.signal)}).`
			)
		}
		process.stdout.write(
			`[validation] step ${index + 1}/${total} passed: ${step.name} (${Date.now() - startedAt}ms${preflightCpuPercent === undefined ? '' : `, preflight CPU ${preflightCpuPercent.toFixed(1)}%`})\n`
		)
	} catch (error) {
		stepError = error
	} finally {
		clearTimeout(timeout)
		clearInterval(heartbeat)
		if (child.exitCode === null && child.signalCode === null) await requestTermination()
		if (terminationPromise !== undefined) await terminationPromise
		try {
			cleanupSucceeded = await exactCleanup()
		} catch (error) {
			cleanupError = error
		}
		childOwner.current = null
	}

	if (stepError !== undefined) {
		if (!cleanupSucceeded) {
			throw new AggregateError(
				cleanupError === undefined ? [stepError] : [stepError, cleanupError],
				`Validation step and process-tree cleanup failed: ${step.name}.`
			)
		}
		throw stepError
	}
	if (!cleanupSucceeded) {
		throw new Error(`Validation process-tree cleanup failed: ${step.name}.`, {
			cause: cleanupError
		})
	}
}

async function waitForCpuPause(
	milliseconds,
	stepName,
	retryNumber,
	maximumRetries,
	interruptedSignal
) {
	process.stdout.write(
		`[validation] CPU cooldown ${retryNumber}/${maximumRetries} before retrying ${stepName}: ${milliseconds}ms; no child process will run.\n`
	)
	let remainingMilliseconds = milliseconds
	while (remainingMilliseconds > 0) {
		const intervalMilliseconds = Math.min(50_000, remainingMilliseconds)
		await delay(intervalMilliseconds)
		remainingMilliseconds -= intervalMilliseconds
		const signal = interruptedSignal()
		if (signal !== null) throw new Error(`Validation interrupted by ${signal}.`)
		process.stdout.write(
			`[validation] CPU cooldown heartbeat for ${stepName}: ${remainingMilliseconds}ms remaining.\n`
		)
	}
}

async function main() {
	const planArgument = process.argv[2]
	if (planArgument === undefined || process.argv.length !== 3) {
		throw new TypeError('Usage: node scripts/run-bounded-validation.mjs <plan.json>')
	}
	const planPath = resolve(planArgument)
	if (!isAbsolute(planPath)) throw new TypeError('Validation plan path must resolve absolutely.')
	const plan = await loadValidationPlan(planPath)
	const lockPath = resolve(plan.workingDirectory, '.test-out', 'validation', `${plan.token}.lock`)
	const childOwner = { current: null }
	const interruption = createValidationInterruptionController(childOwner)
	let handlersInstalled = false
	let cpuPauseRetriesUsed = 0
	const interrupt = (signal) => interruption.interrupt(signal)
	const lock = await acquireValidationLock(lockPath, {
		token: plan.token,
		pid: process.pid,
		startedAt: new Date().toISOString(),
		planPath
	})
	try {
		process.on('SIGINT', interrupt)
		process.on('SIGTERM', interrupt)
		handlersInstalled = true
		for (const [index, step] of plan.steps.entries()) {
			if (interruption.signal() !== null) {
				throw new Error(`Validation interrupted by ${interruption.signal()}.`)
			}
			if (index > 0 && plan.interStepCooldownMilliseconds > 0) {
				process.stdout.write(
					`[validation] cooldown before ${step.name}: ${plan.interStepCooldownMilliseconds}ms\n`
				)
				await delay(plan.interStepCooldownMilliseconds)
				if (interruption.signal() !== null) {
					throw new Error(`Validation interrupted by ${interruption.signal()}.`)
				}
			}
			while (true) {
				try {
					await runStep(
						step,
						index,
						plan.steps.length,
						plan.heartbeatMilliseconds,
						plan.maximumCpuPercent,
						plan.cpuSampleMilliseconds,
						childOwner,
						() => interruption.signal()
					)
					break
				} catch (error) {
					if (
						!(error instanceof CpuLimitReachedError) ||
						plan.cpuPauseMilliseconds === undefined ||
						plan.maximumCpuPauseRetries === undefined ||
						cpuPauseRetriesUsed >= plan.maximumCpuPauseRetries
					) {
						throw error
					}
					cpuPauseRetriesUsed += 1
					await waitForCpuPause(
						plan.cpuPauseMilliseconds,
						error.stepName,
						cpuPauseRetriesUsed,
						plan.maximumCpuPauseRetries,
						() => interruption.signal()
					)
				}
			}
		}
		process.stdout.write(`[validation] plan passed: ${plan.token}\n`)
	} finally {
		if (handlersInstalled) {
			process.off('SIGINT', interrupt)
			process.off('SIGTERM', interrupt)
		}
		try {
			await childOwner.current?.requestTermination()
		} finally {
			await lock.release()
		}
	}
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? '')) {
	main().catch((error) => {
		process.stderr.write(
			`[validation] ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
		)
		process.exitCode = 1
	})
}
