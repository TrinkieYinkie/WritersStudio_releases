import { spawn } from 'node:child_process'
import { join } from 'node:path'
import process from 'node:process'

const maximumOwnedProcessCount = 512
const maximumProtocolBytes = 8 * 1024
const windowsCleanupTimeoutMilliseconds = 10_000
const windowsShutdownTimeoutMilliseconds = 2_000
const posixTerminationGraceMilliseconds = 2_000
const posixKillGraceMilliseconds = 1_000

export const windowsValidationProcessTreeCleanupScript = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try {
	$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
	$rootPid = [int]$request.processId
	$startedAtMs = [long]$request.startedAtMs
	$cleanupStartedAtMs = [long]$request.cleanupStartedAtMs
	if ($rootPid -le 0 -or $startedAtMs -lt 0 -or $cleanupStartedAtMs -lt $startedAtMs) {
		throw 'invalid cleanup identity'
	}
	$startedAt = [DateTimeOffset]::FromUnixTimeMilliseconds($startedAtMs).UtcDateTime
	$cleanupStartedAt = [DateTimeOffset]::FromUnixTimeMilliseconds($cleanupStartedAtMs).UtcDateTime
	$owned = @{}
	$root = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $rootPid" -ErrorAction SilentlyContinue
	if ($null -ne $root) {
		$rootCreatedAt = ([DateTime]$root.CreationDate).ToUniversalTime()
		if ($rootCreatedAt -lt $startedAt -or $rootCreatedAt -gt $cleanupStartedAt) {
			throw 'root process identity changed'
		}
		$owned[$rootPid] = [pscustomobject]@{
			ProcessId = $rootPid
			ParentProcessId = [int]$root.ParentProcessId
			CreationDate = $rootCreatedAt
		}
	}
	$pendingParents = [System.Collections.Generic.Queue[int]]::new()
	$pendingParents.Enqueue($rootPid)
	$queriedParents = @{}
	while ($pendingParents.Count -gt 0) {
		$parentPid = $pendingParents.Dequeue()
		if ($queriedParents.ContainsKey($parentPid)) { continue }
		$queriedParents[$parentPid] = $true
		$children = @(Get-CimInstance -ClassName Win32_Process -Filter "ParentProcessId = $parentPid" -ErrorAction SilentlyContinue)
		foreach ($candidate in $children) {
			$pidValue = [int]$candidate.ProcessId
			$parentValue = [int]$candidate.ParentProcessId
			$createdAt = ([DateTime]$candidate.CreationDate).ToUniversalTime()
			if ($parentValue -ne $parentPid -or $createdAt -lt $startedAt -or $createdAt -gt $cleanupStartedAt) {
				continue
			}
			if (!$owned.ContainsKey($pidValue)) {
				if ($owned.Count -ge ${maximumOwnedProcessCount}) { throw 'owned process bound exceeded' }
				$owned[$pidValue] = [pscustomobject]@{
					ProcessId = $pidValue
					ParentProcessId = $parentValue
					CreationDate = $createdAt
				}
				$pendingParents.Enqueue($pidValue)
			}
		}
	}
	$ordered = @($owned.Values | Sort-Object CreationDate -Descending)
	foreach ($expected in $ordered) {
		$current = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $($expected.ProcessId)" -ErrorAction SilentlyContinue
		if ($null -eq $current) { continue }
		$currentCreatedAt = ([DateTime]$current.CreationDate).ToUniversalTime()
		if ([int]$current.ParentProcessId -ne $expected.ParentProcessId -or $currentCreatedAt -ne $expected.CreationDate) {
			throw 'process identity changed'
		}
		Stop-Process -Id $expected.ProcessId -Force -ErrorAction Stop
	}
	$deadline = [DateTime]::UtcNow.AddMilliseconds(${windowsShutdownTimeoutMilliseconds})
	do {
		$remaining = @()
		foreach ($expected in $ordered) {
			$current = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $($expected.ProcessId)" -ErrorAction SilentlyContinue
			if ($null -eq $current) { continue }
			$currentCreatedAt = ([DateTime]$current.CreationDate).ToUniversalTime()
			if ([int]$current.ParentProcessId -eq $expected.ParentProcessId -and $currentCreatedAt -eq $expected.CreationDate) {
				$remaining += $expected.ProcessId
			}
		}
		if ($remaining.Count -eq 0) {
			[Console]::Out.WriteLine('clean')
			exit 0
		}
		Start-Sleep -Milliseconds 20
	} while ([DateTime]::UtcNow -lt $deadline)
	throw 'cleanup timed out'
} catch {
	[Console]::Out.WriteLine('failed')
	exit 1
}
`

function wait(milliseconds) {
	return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds))
}

function validIdentity(identity) {
	return (
		Number.isSafeInteger(identity.processId) &&
		identity.processId > 0 &&
		Number.isSafeInteger(identity.startedAtMs) &&
		identity.startedAtMs >= 0 &&
		Number.isSafeInteger(identity.cleanupStartedAtMs) &&
		identity.cleanupStartedAtMs >= identity.startedAtMs
	)
}

function appendBounded(chunks, chunk, currentBytes) {
	const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
	const remaining = maximumProtocolBytes - currentBytes
	if (remaining <= 0) return Object.freeze({ bytes: currentBytes, overflow: true })
	const accepted = value.byteLength <= remaining ? value : value.subarray(0, remaining)
	chunks.push(Buffer.from(accepted))
	return Object.freeze({
		bytes: currentBytes + accepted.byteLength,
		overflow: value.byteLength > remaining
	})
}

async function cleanupWindowsProcessTree(identity) {
	const systemRoot = process.env.SystemRoot ?? process.env.WINDIR ?? 'C:\\Windows'
	const executable = join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
	const encodedScript = Buffer.from(
		windowsValidationProcessTreeCleanupScript,
		'utf16le'
	).toString('base64')
	let child
	try {
		child = spawn(
			executable,
			['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encodedScript],
			{ shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }
		)
	} catch {
		return false
	}
	const stdout = []
	const stderr = []
	let stdoutBytes = 0
	let stderrBytes = 0
	let overflow = false
	child.stdout?.on('data', (chunk) => {
		const result = appendBounded(stdout, chunk, stdoutBytes)
		stdoutBytes = result.bytes
		overflow ||= result.overflow
	})
	child.stderr?.on('data', (chunk) => {
		const result = appendBounded(stderr, chunk, stderrBytes)
		stderrBytes = result.bytes
		overflow ||= result.overflow
	})
	child.stdin?.end(`${JSON.stringify(identity)}\n`, 'utf8')

	let timedOut = false
	const timeout = setTimeout(() => {
		timedOut = true
		child.kill('SIGKILL')
	}, windowsCleanupTimeoutMilliseconds)
	const outcome = await new Promise((resolveOutcome) => {
		child.once('error', () => resolveOutcome({ code: null, signal: null }))
		child.once('close', (code, signal) => resolveOutcome({ code, signal }))
	})
	clearTimeout(timeout)
	return (
		!timedOut &&
		!overflow &&
		outcome.code === 0 &&
		outcome.signal === null &&
		Buffer.concat(stdout).toString('utf8').trim() === 'clean'
	)
}

function posixProcessGroupExists(processId) {
	try {
		process.kill(-processId, 0)
		return true
	} catch (error) {
		if (error?.code === 'ESRCH') return false
		throw error
	}
}

async function waitForPosixProcessGroupExit(processId, timeoutMilliseconds) {
	const deadline = Date.now() + timeoutMilliseconds
	while (Date.now() < deadline) {
		if (!posixProcessGroupExists(processId)) return true
		await wait(20)
	}
	return !posixProcessGroupExists(processId)
}

async function cleanupPosixProcessGroup(processId) {
	try {
		if (!posixProcessGroupExists(processId)) return true
		process.kill(-processId, 'SIGTERM')
		if (await waitForPosixProcessGroupExit(processId, posixTerminationGraceMilliseconds)) {
			return true
		}
		process.kill(-processId, 'SIGKILL')
		return await waitForPosixProcessGroupExit(processId, posixKillGraceMilliseconds)
	} catch (error) {
		return error?.code === 'ESRCH'
	}
}

/** Cleans only the process tree/group proven to belong to one validation-stage root. */
export async function cleanupValidationProcessTree(identity) {
	if (!validIdentity(identity)) return false
	return process.platform === 'win32'
		? cleanupWindowsProcessTree(identity)
		: cleanupPosixProcessGroup(identity.processId)
}
