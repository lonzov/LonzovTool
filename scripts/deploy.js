import { NodeSSH } from 'node-ssh'
import { existsSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import readline from 'readline'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CONFIG_PATH = join(ROOT, 'deploy.config.json')
const DIST_DIR = join(ROOT, 'dist')
const ARCHIVE_LOCAL = join(ROOT, 'dist.7z')

// ── helpers ────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

/** pip 风格 Unicode 1/8 block 进度条 */
function renderBar(percent, width = 30) {
  const clamped = Math.max(0, Math.min(100, percent))
  const slot = (width * clamped) / 100
  const full = Math.floor(slot)
  const frac = slot - full
  const FRAC_CHARS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']
  const fracChar = FRAC_CHARS[Math.round(frac * 8)] || ''
  const used = full + (fracChar ? 1 : 0)
  const empty = Math.max(0, width - used)
  return '█'.repeat(full) + fracChar + '░'.repeat(empty)
}

function pad(n, len = 2) {
  return String(n).padStart(len, '0')
}

function timestamp() {
  const d = new Date()
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    '-',
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds()),
  ].join('')
}

function clearLine() {
  process.stdout.write('\r\x1b[K')
}

// ── config ─────────────────────────────────────────────

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    console.log('❌ 未找到 deploy.config.json，请复制 deploy.config.example.json 并填写服务器信息')
    process.exit(1)
  }
  const raw = readFileSync(CONFIG_PATH, 'utf-8')
  try {
    return JSON.parse(raw)
  } catch {
    console.log('❌ deploy.config.json 格式错误，请检查 JSON 语法')
    process.exit(1)
  }
}

function saveConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}

// ── archive ────────────────────────────────────────────

function find7z() {
  // 优先用 PATH 里的，否则搜常见路径
  try {
    execSync('7z --help', { stdio: 'pipe' })
    return '7z'
  } catch {
    /* PATH 中找不到，继续搜常见路径 */
  }
  const candidates = [
    'C:/Program Files/7-Zip/7z.exe',
    'C:/Program Files (x86)/7-Zip/7z.exe',
    '/usr/bin/7z',
    '/usr/local/bin/7z',
  ]
  for (const c of candidates) {
    if (existsSync(c)) return `"${c}"`
  }
  console.log('❌ 未找到 7z，请安装 7-Zip 并添加到 PATH')
  process.exit(1)
}

function createArchive() {
  if (!existsSync(DIST_DIR)) {
    console.log(`❌ 未找到构建产物 ${DIST_DIR}，请先执行 pnpm build`)
    process.exit(1)
  }
  // 删除旧压缩包
  if (existsSync(ARCHIVE_LOCAL)) unlinkSync(ARCHIVE_LOCAL)
  console.log('  📦 打包构建产物 (7z)...')
  const cmd7z = find7z()
  execSync(`${cmd7z} a -mx=9 "${ARCHIVE_LOCAL}" .`, { cwd: DIST_DIR, stdio: 'pipe' })
  const size = statSync(ARCHIVE_LOCAL).size
  console.log(`  ✓ 打包完成 (${formatSize(size)})`)
  return size
}

// ── confirm ────────────────────────────────────────────

async function confirmDeploy(config) {
  if (config.skipConfirm) return

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  const question = [
    '',
    `目标: ${config.username}@${config.host}:${config.port}`,
    `路径: ${config.sitePath}/${config.distName}`,
    `存档: 保留最近 ${config.keepArchives} 个`,
    '',
    '[y] 继续  [n] 取消  [ay] 继续且不再询问',
  ].join('\n')

  return new Promise((resolve) => {
    rl.question(question + '\n> ', (answer) => {
      rl.close()
      const a = answer.trim().toLowerCase()
      if (a === 'n') {
        console.log('  已取消部署')
        process.exit(0)
      }
      if (a === 'ay') {
        config.skipConfirm = true
        saveConfig(config)
        console.log('  已保存，下次不再询问\n')
      }
      if (a === 'y' || a === 'ay') {
        resolve()
      } else {
        console.log('  无效输入，已取消部署')
        process.exit(0)
      }
    })
  })
}

// ── SSH / SFTP ─────────────────────────────────────────

async function connectSSH(config) {
  const ssh = new NodeSSH()
  const privateKey = readFileSync(config.privateKey, 'utf-8')
  await ssh.connect({
    host: config.host,
    port: config.port || 22,
    username: config.username,
    privateKey,
    readyTimeout: 30000,
  })
  return ssh
}

async function uploadWithProgress(ssh, config) {
  const size = statSync(ARCHIVE_LOCAL).size
  const tmpPath = `${config.sitePath}/dist.7z.tmp`
  const finalPath = `${config.sitePath}/dist.7z`

  // 清理远端残留 .tmp
  await ssh.execCommand(`rm -f "${tmpPath}"`)

  console.log(`  ⬆ 上传中...`)
  let lastLineLen = 0

  await ssh.putFile(ARCHIVE_LOCAL, tmpPath, null, {
    step(totalTransferred) {
      const pct = size > 0 ? (totalTransferred / size) * 100 : 0
      const bar = renderBar(pct)
      const line = `  ${pct.toFixed(1).padStart(5)}% |${bar}| ${formatSize(totalTransferred)}/${formatSize(size)}`
      clearLine()
      process.stdout.write(line)
      lastLineLen = line.length
    },
  })

  clearLine()
  // 用空格覆盖残留字符防止终端残留
  process.stdout.write(`  ✓ 上传完成 (${formatSize(size)})${' '.repeat(Math.max(0, lastLineLen - 20))}\n`)

  // 原子重命名
  await ssh.execCommand(`mv "${tmpPath}" "${finalPath}"`)
}

// ── remote deploy ──────────────────────────────────────

async function runRemote(ssh, config) {
  const sp = config.sitePath
  const dn = config.distName
  const ts = timestamp()
  const archiveName = `${dn}-${ts}.7z`
  const archiveDir = `${sp}/archives`

  console.log('  🔧 远端部署中...')

  // 1. 确保 archives/ 存在
  await ssh.execCommand(`mkdir -p "${archiveDir}"`)

  // 2. 移动压缩包到 archives/
  await ssh.execCommand(`mv "${sp}/dist.7z" "${archiveDir}/${archiveName}"`)

  // 3. 清理旧存档（保留最近 N 个）
  await ssh.execCommand(
    `cd "${archiveDir}" && ls -1t *.7z 2>/dev/null | tail -n +${config.keepArchives + 1} | xargs -r rm -f`,
  )

  // 4. 清理上次可能残留的临时目录
  await ssh.execCommand(`rm -rf "${sp}/${dn}-new"`)

  // 5. 创建临时目录并解压
  await ssh.execCommand(`mkdir -p "${sp}/${dn}-new"`)
  await ssh.execCommand(`7z x "${archiveDir}/${archiveName}" -o"${sp}/${dn}-new"`)

  // 6. 原子替换
  const distPath = `${sp}/${dn}`
  const newPath = `${sp}/${dn}-new`
  const oldPath = `${sp}/${dn}-old`

  // 如果 dist-old 残留（上次失败），先清理
  await ssh.execCommand(`rm -rf "${oldPath}"`)

  // 检查 dist 是否存在
  const distCheck = await ssh.execCommand(`test -d "${distPath}" && echo "exists" || echo "missing"`)
  const distExists = distCheck.stdout.trim() === 'exists'

  if (distExists) {
    await ssh.execCommand(`mv "${distPath}" "${oldPath}"`)
  }
  await ssh.execCommand(`mv "${newPath}" "${distPath}"`)
  await ssh.execCommand(`rm -rf "${oldPath}"`)

  // 7. 修正权限 (root → www)
  if (config.owner) {
    await ssh.execCommand(`chown -R ${config.owner} "${distPath}"`)
    await ssh.execCommand(`find "${distPath}" -type d -exec chmod 755 {} +`)
    await ssh.execCommand(`find "${distPath}" -type f -exec chmod 644 {} +`)
  }

  // 8. 后置命令
  if (config.afterCmd) {
    console.log(`  ⚡ 执行后置命令: ${config.afterCmd}`)
    const result = await ssh.execCommand(config.afterCmd)
    if (result.stdout) console.log(result.stdout.trim())
    if (result.stderr) console.error(result.stderr.trim())
  }
}

// ── retry wrapper ──────────────────────────────────────

async function withRetry(fn, label, maxRetries) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxRetries) {
        throw new Error(`${label} 失败 (${attempt}/${maxRetries}): ${err.message}`, { cause: err })
      }
      console.log(`  ⚠ ${label} 失败 (${attempt}/${maxRetries})，重试中...`)
      await sleep(2000)
    }
  }
}

// ── main ───────────────────────────────────────────────

async function main() {
  console.log('\n🚀 小舟工具箱 · 部署脚本\n')

  const config = loadConfig()

  // 1. 打包
  createArchive()

  // 2. 确认
  await confirmDeploy(config)

  // 3. 连接 & 部署
  let ssh
  try {
    ssh = await withRetry(
      () => connectSSH(config),
      'SSH 连接',
      config.maxRetries || 3,
    )

    await withRetry(
      () => uploadWithProgress(ssh, config),
      '上传',
      config.maxRetries || 3,
    )

    await withRetry(
      () => runRemote(ssh, config),
      '远端部署',
      config.maxRetries || 3,
    )

    console.log('\n✅ 部署成功!\n')
  } finally {
    if (ssh) ssh.dispose()
    // 清理本地压缩包
    if (existsSync(ARCHIVE_LOCAL)) {
      unlinkSync(ARCHIVE_LOCAL)
      console.log('  🧹 已清理本地临时文件')
    }
  }
}

main().catch((err) => {
  console.error(`\n❌ 部署失败: ${err.message}\n`)
  process.exit(1)
})
