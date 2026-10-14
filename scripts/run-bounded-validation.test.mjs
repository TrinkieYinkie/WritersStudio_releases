import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { describe, it } from 'node:test'
import {
	acquireValidationLock,
	calculateCpuPercent,
	createValidationInterruptionController,
	loadValidationPlan,
	parsePlan
} from './run-bounded-validation.mjs'
import { cleanupValidationProcessTree } from './validation-process-tree-cleanup.mjs'

const step = Object.freeze({
	name: 'test',
	command: '$NODE',
	args: Object.freeze(['--version']),
	timeoutMilliseconds: 1_000
})

function processExists(processId) {
	try {
		process.kill(processId, 0)
		return true
	} catch (error) {
		if (error?.code === 'ESRCH') return false
		throw error
	}
}

function runNode(arguments_, workingDirectory, timeoutMilliseconds = 20_000) {
	return new Promise((resolveRun, rejectRun) => {
		const child = spawn(process.execPath, arguments_, {
			cwd: workingDirectory,
			shell: false,
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true
		})
		const stdout = []
		const stderr = []
		const timeout = setTimeout(() => child.kill('SIGKILL'), timeoutMilliseconds)
		child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)))
		child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)))
		child.once('error', rejectRun)
		child.once('close', (code, signal) => {
			clearTimeout(timeout)
			resolveRun({
				code,
				signal,
				stdout: Buffer.concat(stdout).toString('utf8'),
				stderr: Buffer.concat(stderr).toString('utf8')
			})
		})
	})
}

describe('bounded validation CPU guard', () => {
	it('calculates normalized total CPU use from monotonic counters', () => {
		assert.equal(calculateCpuPercent({ idle: 100, total: 200 }, { idle: 130, total: 300 }), 70)
		assert.equal(calculateCpuPercent({ idle: 100, total: 200 }, { idle: 200, total: 300 }), 0)
		assert.throws(
			() => calculateCpuPercent({ idle: 100, total: 200 }, { idle: 100, total: 200 }),
			/did not advance/u
		)
	})

	it('accepts an exact optional CPU ceiling and bounded sample interval', () => {
		const plan = parsePlan(
			{
				token: 'cpu-guard-test',
				maximumCpuPercent: 50,
				cpuSampleMilliseconds: 250,
				interStepCooldownMilliseconds: 1_000,
				cpuPauseMilliseconds: 600_000,
				maximumCpuPauseRetries: 12,
				steps: [step]
			},
			process.cwd()
		)

		assert.equal(plan.maximumCpuPercent, 50)
		assert.equal(plan.cpuSampleMilliseconds, 250)
		assert.equal(plan.interStepCooldownMilliseconds, 1_000)
		assert.equal(plan.cpuPauseMilliseconds, 600_000)
		assert.equal(plan.maximumCpuPauseRetries, 12)
		assert.throws(
			() =>
				parsePlan(
					{ token: 'cpu-guard-test', maximumCpuPercent: 0, steps: [step] },
					process.cwd()
				),
			/Maximum CPU percent/u
		)
		assert.throws(
			() =>
				parsePlan(
					{
						token: 'cpu-guard-test',
						maximumCpuPercent: 50,
						cpuSampleMilliseconds: 100,
						steps: [step]
					},
					process.cwd()
				),
			/CPU sample interval/u
		)
		assert.throws(
			() =>
				parsePlan(
					{ token: 'cpu-guard-test', maximumCpuPercent: 101, steps: [step] },
					process.cwd()
				),
			/Maximum CPU percent/u
		)
		assert.throws(
			() =>
				parsePlan(
					{ token: 'cpu-guard-test', cpuSampleMilliseconds: 250, steps: [step] },
					process.cwd()
				),
			/requires a maximum CPU percent/u
		)
		assert.throws(
			() =>
				parsePlan(
					{
						token: 'cpu-guard-test',
						maximumCpuPercent: 50,
						cpuPauseMilliseconds: 600_000,
						steps: [step]
					},
					process.cwd()
				),
			/configured together/u
		)
		assert.throws(
			() =>
				parsePlan(
					{
						token: 'cpu-guard-test',
						cpuPauseMilliseconds: 600_000,
						maximumCpuPauseRetries: 12,
						steps: [step]
					},
					process.cwd()
				),
			/requires a maximum CPU percent/u
		)
	})
})

describe('bounded validation plan composition', () => {
	it('expands one same-directory base inside the same lifecycle owner', async () => {
		const root = await mkdtemp(join(tmpdir(), 'writersstudio-validation-plan-'))
		try {
			await writeFile(
				join(root, 'base.json'),
				JSON.stringify({ token: 'base-plan', steps: [{ ...step, name: 'base' }] })
			)
			await writeFile(
				join(root, 'derived.json'),
				JSON.stringify({
					token: 'derived-plan',
					extends: './base.json',
					prependSteps: [{ ...step, name: 'before' }],
					appendSteps: [{ ...step, name: 'after' }]
				})
			)

			const plan = await loadValidationPlan(join(root, 'derived.json'))
			assert.equal(plan.token, 'derived-plan')
			assert.deepEqual(
				plan.steps.map((candidate) => candidate.name),
				['before', 'base', 'after']
			)
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	it('rejects inheritance cycles and unknown policy fields', async () => {
		const root = await mkdtemp(join(tmpdir(), 'writersstudio-validation-cycle-'))
		try {
			await writeFile(
				join(root, 'first.json'),
				JSON.stringify({ token: 'first-plan', extends: './second.json' })
			)
			await writeFile(
				join(root, 'second.json'),
				JSON.stringify({ token: 'second-plan', extends: './first.json' })
			)

			await assert.rejects(
				() => loadValidationPlan(join(root, 'first.json')),
				/inheritance contains a cycle/u
			)
			assert.throws(
				() => parsePlan({ token: 'unknown-field', steps: [step], shell: true }, root),
				/unsupported fields/u
			)
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})
})

describe('bounded validation ownership', () => {
	it('rejects a duplicate owner and releases the exact lock idempotently', async () => {
		const root = await mkdtemp(join(tmpdir(), 'writersstudio-validation-lock-'))
		const lockPath = join(root, 'validation.lock')
		try {
			const owner = await acquireValidationLock(lockPath, { token: 'first', pid: 1 })
			await assert.rejects(
				() => acquireValidationLock(lockPath, { token: 'second', pid: 2 }),
				/already running/u
			)
			await owner.release()
			await owner.release()
			const replacement = await acquireValidationLock(lockPath, { token: 'third', pid: 3 })
			await replacement.release()
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	it('propagates only the first termination signal to the exact active child owner', async () => {
		let terminations = 0
		const diagnostics = []
		const childOwner = {
			current: {
				requestTermination: async () => {
					terminations += 1
				}
			}
		}
		const interruption = createValidationInterruptionController(childOwner, (message) =>
			diagnostics.push(message)
		)

		interruption.interrupt('SIGTERM')
		interruption.interrupt('SIGINT')
		await new Promise((resolveWait) => setImmediate(resolveWait))

		assert.equal(interruption.signal(), 'SIGTERM')
		assert.equal(terminations, 1)
		assert.equal(diagnostics.length, 1)
	})

	it('cleans a successful stage descendant after the stage root exits', async () => {
		const root = await mkdtemp(join(tmpdir(), 'writersstudio-validation-success-cleanup-'))
		const identityPath = join(root, 'descendant.json')
		const helperPath = join(root, 'leave-descendant.mjs')
		const planPath = join(root, 'plan.json')
		let identity
		try {
			await writeFile(
				helperPath,
				`import { spawn } from 'node:child_process'\nimport { writeFile } from 'node:fs/promises'\nimport process from 'node:process'\nconst startedAtMs = Date.now()\nconst child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: false, shell: false, stdio: 'ignore', windowsHide: true })\nawait writeFile(process.argv[2], JSON.stringify({ processId: child.pid, startedAtMs }))\nchild.unref()\n`,
				'utf8'
			)
			await writeFile(
				planPath,
				JSON.stringify({
					token: 'success-cleanup-test',
					workingDirectory: root,
					heartbeatMilliseconds: 1_000,
					steps: [
						{
							name: 'leave descendant',
							command: '$NODE',
							args: [helperPath, identityPath],
							timeoutMilliseconds: 5_000
						}
					]
				}),
				'utf8'
			)

			const result = await runNode(
				['scripts/run-bounded-validation.mjs', planPath],
				process.cwd()
			)
			assert.equal(result.code, 0, result.stderr)
			assert.equal(result.signal, null)
			assert.match(result.stdout, /plan passed: success-cleanup-test/u)
			identity = JSON.parse(await readFile(identityPath, 'utf8'))
			assert.equal(processExists(identity.processId), false)
		} finally {
			if (identity !== undefined && processExists(identity.processId)) {
				await cleanupValidationProcessTree({
					...identity,
					cleanupStartedAtMs: Date.now()
				})
			}
			await rm(root, { recursive: true, force: true })
		}
	})

	it('fails closed when a live Windows root predates the claimed ownership window', async () => {
		if (process.platform !== 'win32') return
		const startedAtMs = Date.now()
		assert.equal(
			await cleanupValidationProcessTree({
				processId: process.pid,
				startedAtMs,
				cleanupStartedAtMs: startedAtMs
			}),
			false
		)
	})
})
