param(
  [switch]$Mobile
)

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

$ProjectRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$Port = 3000
$HostAddress = if ($Mobile) { '0.0.0.0' } else { '127.0.0.1' }
$ModeTitle = if ($Mobile) { 'IronPath iPhone Safari 测试启动器' } else { 'IronPath 本地一键启动器' }

function Exit-WithPause {
  param([int]$Code)
  Read-Host '按回车键退出'
  exit $Code
}

Set-Location $ProjectRoot

Write-Host ''
Write-Host '========================================'
Write-Host "       $ModeTitle"
Write-Host '========================================'
Write-Host ''

if (-not (Test-Path 'package.json')) {
  Write-Host '[错误] 当前目录不是 IronPath 项目目录。'
  Write-Host '请把启动脚本放在包含 package.json 的 IronPath 项目根目录中。'
  Exit-WithPause 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host '[错误] 未检测到 Node.js。'
  Write-Host '请安装 Node.js LTS 版本：https://nodejs.org/'
  Write-Host '安装完成后，请关闭并重新打开 PowerShell / 终端，再双击启动脚本。'
  Exit-WithPause 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host '[错误] 未检测到 npm。'
  Write-Host 'npm 通常会随 Node.js LTS 一起安装。'
  Write-Host '请安装 Node.js LTS 版本：https://nodejs.org/'
  Write-Host '安装完成后，请关闭并重新打开 PowerShell / 终端，再双击启动脚本。'
  Exit-WithPause 1
}

if (-not (Test-Path 'node_modules')) {
  Write-Host '[信息] 未发现 node_modules，正在安装依赖...'
  Write-Host '这一步第一次运行可能需要几分钟。'
  Write-Host ''
  & npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host '[错误] npm install 失败，无法继续启动。'
    Write-Host '请检查网络连接，或删除 node_modules 后重试。'
    Exit-WithPause 1
  }
}

if ($Mobile) {
  Write-Host ''
  Write-Host '[手机访问说明]'
  Write-Host '1. 确保 iPhone 和这台电脑连接同一个 Wi-Fi。'
  Write-Host '2. 在下面的网络信息里找到类似 192.168.x.x 的 IPv4 地址。'
  Write-Host '3. 在 iPhone Safari 打开：http://你的IPv4地址:3000/'
  Write-Host '   示例：http://192.168.1.25:3000/'
  Write-Host ''
  Write-Host '[当前网络信息]'
  try {
    ipconfig | Select-String -Pattern 'IPv4'
  } catch {
    Write-Host '无法自动读取 ipconfig，请手动打开命令行运行 ipconfig 查看 IPv4 地址。'
  }
  Write-Host ''
} else {
  $LocalUrl = "http://127.0.0.1:$Port/"
  Write-Host ''
  Write-Host "[信息] 正在打开浏览器：$LocalUrl"
  try {
    Start-Process $LocalUrl
  } catch {
    Write-Host "[警告] 浏览器未能自动打开，请手动访问：$LocalUrl"
  }
}

Write-Host ''
Write-Host "[信息] 正在启动 IronPath 开发服务器：host=$HostAddress port=$Port"
Write-Host '如果提示端口 3000 被占用，请关闭占用该端口的程序后重新运行。'
Write-Host ''

& npm run dev -- --host $HostAddress --port $Port
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host '[警告] npm run dev 启动失败，尝试使用本地 Vite 直接启动...'
  Write-Host ''

  $ViteCli = Join-Path $ProjectRoot 'node_modules/vite/bin/vite.js'
  if (-not (Test-Path $ViteCli)) {
    Write-Host '[错误] 未找到本地 Vite CLI。请重新执行 npm install 后再试。'
    Exit-WithPause 1
  }

  & node $ViteCli --host $HostAddress --port $Port
  if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host '[错误] IronPath 启动失败。'
    Write-Host '请确认端口 3000 没有被占用，或重新执行 npm install 后再试。'
    Exit-WithPause 1
  }
}

exit 0
