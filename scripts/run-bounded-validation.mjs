import { open, readFile, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '..')
const lockPath = resolve(scriptDirectory, '.site-validation.lock')
const planArgument = process.argv[2]
const minimumTimeoutMilliseconds = 1_000
const maximumTimeoutMilliseconds = 120_000

let activeChild
let activeStep
let interruptedSignal
let lockHandle

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} must be a non-empty string.`)
  return value
}

function parsePlan(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Validation plan must be an object.')
  const allowedPlanKeys = new Set(['token', 'heartbeatMilliseconds', 'steps'])
  const unknownPlanKeys = Object.keys(value).filter((key) => !allowedPlanKeys.has(key))
  if (unknownPlanKeys.length > 0) throw new TypeError(`Unsupported plan fields: ${unknownPlanKeys.join(', ')}.`)

  const token = requireString(value.token, 'Plan token')
  if (!/^[a-z0-9][a-z0-9-]{2,64}$/u.test(token)) throw new TypeError('Plan token contains unsupported characters.')
  const heartbeatMilliseconds = value.heartbeatMilliseconds ?? 5_000
  if (!Number.isSafeInteger(heartbeatMilliseconds) || heartbeatMilliseconds < 1_000 || heartbeatMilliseconds > 30_000) {
    throw new TypeError('Heartbeat interval must be between 1000 and 30000 milliseconds.')
  }
  if (!Array.isArray(value.steps) || value.steps.length === 0) throw new TypeError('Validation plan must contain steps.')

  const steps = value.steps.map((step, index) => {
    if (!step || typeof step !== 'object' || Array.isArray(step)) throw new TypeError(`Step ${index + 1} must be an object.`)
    const allowedStepKeys = new Set(['name', 'args', 'timeoutMilliseconds'])
    const unknownStepKeys = Object.keys(step).filter((key) => !allowedStepKeys.has(key))
    if (unknownStepKeys.length > 0) throw new TypeError(`Step ${index + 1} contains unsupported fields: ${unknownStepKeys.join(', ')}.`)
    if (!Array.isArray(step.args) || !step.args.every((arg) => typeof arg === 'string')) {
      throw new TypeError(`Step ${index + 1} args must be strings.`)
    }
    if (
      !Number.isSafeInteger(step.timeoutMilliseconds)
      || step.timeoutMilliseconds < minimumTimeoutMilliseconds
      || step.timeoutMilliseconds > maximumTimeoutMilliseconds
    ) {
      throw new TypeError(`Step ${index + 1} timeout must be between 1000 and 120000 milliseconds.`)
    }
    return Object.freeze({
      args: [...step.args],
      name: requireString(step.name, `Step ${index + 1} name`),
      timeoutMilliseconds: step.timeoutMilliseconds
    })
  })

  return Object.freeze({ heartbeatMilliseconds, steps, token })
}

function terminateOwnedChild(signal = 'SIGTERM') {
  if (!activeChild || activeChild.exitCode !== null || activeChild.signalCode !== null) return
  console.error(`[cleanup] terminating owned child pid=${activeChild.pid} step=${activeStep}`)
  activeChild.kill(signal)
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.once(signal, () => {
    interruptedSignal = signal
    terminateOwnedChild('SIGTERM')
  })
}

async function runStep(step, plan, index) {
  if (interruptedSignal) throw new Error(`Validation interrupted by ${interruptedSignal}.`)
  activeStep = step.name
  const startedAt = Date.now()
  console.log(`[${index + 1}/${plan.steps.length}] START ${step.name} · timeout=${step.timeoutMilliseconds}ms`)

  const child = spawn(process.execPath, step.args, {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      WRITERSSTUDIO_VALIDATION_TOKEN: plan.token
    },
    shell: false,
    stdio: 'inherit',
    windowsHide: true
  })
  activeChild = child
  console.log(`[${index + 1}/${plan.steps.length}] OWNER pid=${child.pid} token=${plan.token}`)

  let timedOut = false
  const heartbeat = setInterval(() => {
    console.log(`[heartbeat] step=${step.name} pid=${child.pid} elapsed=${Date.now() - startedAt}ms`)
  }, plan.heartbeatMilliseconds)

  const timeout = setTimeout(() => {
    timedOut = true
    console.error(`[timeout] step=${step.name} pid=${child.pid}`)
    terminateOwnedChild('SIGTERM')
  }, step.timeoutMilliseconds)

  try {
    const result = await new Promise((resolveResult, rejectResult) => {
      child.once('error', rejectResult)
      child.once('exit', (code, signal) => resolveResult({ code, signal }))
    })
    if (timedOut) throw new Error(`${step.name} exceeded ${step.timeoutMilliseconds}ms.`)
    if (interruptedSignal) throw new Error(`Validation interrupted by ${interruptedSignal}.`)
    if (result.code !== 0) throw new Error(`${step.name} failed with exit code ${result.code ?? 'none'}${result.signal ? ` (${result.signal})` : ''}.`)
    console.log(`[${index + 1}/${plan.steps.length}] PASS ${step.name} · ${Date.now() - startedAt}ms`)
  } finally {
    clearInterval(heartbeat)
    clearTimeout(timeout)
    if (activeChild === child) activeChild = undefined
    activeStep = undefined
  }
}

async function main() {
  if (!planArgument) throw new TypeError('Usage: node scripts/run-bounded-validation.mjs <plan.json>')
  const planPath = resolve(repositoryRoot, planArgument)
  if (!planPath.startsWith(`${repositoryRoot}\\`) && !planPath.startsWith(`${repositoryRoot}/`)) {
    throw new TypeError('Validation plan must stay inside the repository.')
  }
  const plan = parsePlan(JSON.parse(await readFile(planPath, 'utf8')))

  try {
    lockHandle = await open(lockPath, 'wx')
    await lockHandle.writeFile(`${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), token: plan.token })}\n`)
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`Another site validation owns ${lockPath}.`)
    throw error
  }

  console.log(`Validation owner pid=${process.pid} token=${plan.token}`)
  for (const [index, step] of plan.steps.entries()) await runStep(step, plan, index)
  console.log(`Validation complete · ${plan.steps.length} sequential steps passed.`)
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  terminateOwnedChild('SIGKILL')
  await lockHandle?.close()
  await rm(lockPath, { force: true })
}
