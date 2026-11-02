$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = Split-Path -Parent $PSScriptRoot
$releaseRoot = Join-Path $projectRoot 'release'
$releaseVersion = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
$sourceRoot = (Resolve-Path -LiteralPath (Join-Path $releaseRoot ($releaseVersion + '/win-unpacked'))).Path
$zipPath = Join-Path $releaseRoot ('KP备团台-' + $releaseVersion + '-Windows-x64.zip')
if (Test-Path -LiteralPath $zipPath) { throw '发布包已存在，避免覆盖。' }
$guide = @'
KP 备团台 0.13.0 · Windows 10/11 x64 免安装版

1. 完整解压压缩包，再打开文件夹内的 KP备团台.exe。
   请保留同一目录内的所有文件，不要单独移动 EXE。
2. 应用设置 → AI 服务商选择 DeepSeek。
3. 在软件内填写自己的 DeepSeek API Key，点击“安全保存 DeepSeek 密钥”。
4. 默认模型 deepseek-flash；也可选择 deepseek-v4-pro。
5. 点击“保存并测试”，导入 PDF 并提取文字，随后点击“AI 提取”。
   连接测试检查认证和模型可用性；实际提取还需要服务商账户有可用余额。

OpenAI 和 DeepSeek 的密钥、模型分别保存，可随时切换。
密钥加密保存在当前 Windows 用户下，不包含在发布包或项目备份里。
确认开始后台提取后，会按计划向选定服务商发送原文和背景索引，包含多个付费请求。
离线 PDF 扫描、OCR、资料整理仍可使用。

0.13.0 统一事实核对页面布局，描述墙补齐当前记录；描述仍为本模组各记录共用。
卡片编辑改为大窗口，正文与辅助设置分栏，保存按钮固定，可展开编辑；小窗口自动纵向排列。
移除备团包界面及生成入口，旧版打开位置转到事实核对；历史资料仍兼容。
0.12.2 描述卡片使用弹窗编辑，保存后生效，取消保留原内容。地图资料栏新增“描述”，支持点击加号或拖入地图；编辑、预览和 PNG 导出读取同一份描述。
0.12.1 “描述”墙位于事实核对模块，与真相、人物、场景、线索、时间线并列；旧描述保持不变。
0.12.0 新增“描述”墙，输入概述后使用当前服务商、模型和密钥扩写；手动确认发送，草稿可编辑采用，随项目保存和备份。
0.11.1 提取任务改为悬浮球，点击展开列表，点击外部收起。地图预览点击卡片保留当前视野，搜索与相邻地点跳转仍可定位。
墙上确认按钮样式统一，卡片放大固定在纸张附近并跟随纸张滚动。展开卡片可删除，需确认；原文和其他记录保留，关联地图显示事实已移除。
0.11.0 场景地图新增“带团预览”：拖动只浏览，不移动地图块。点击查看正文、人物数值和出处，可搜索定位与跳转相连地点。
“展开地图”覆盖应用工作区；Esc 先关闭详情、再收起展开视图。“返回编辑”恢复制作视野。
预览会在本次运行中记住每张地图的浏览位置，重开后从编辑视野开始；预览为 KP 用，包含秘密内容。
“默认字号”设置整张地图标题大小；选中地图块后可单独设置或恢复跟随默认，多选支持批量字号。范围 10–48，PNG 导出同步。
0.10.1 修复再次导入 PDF 时一直停在读取文件的问题。
导入显示读取、解析、保存本机和准备预览四个阶段；文字提取显示已处理页数进度，取消后保留已完成页面。
新版支持全文提取，不再要求按 18000 字符手动拆分。
0.7.0 收紧核心真相标准，人物一人一卡，场景一处可活动空间一卡。
0.10.0 场景墙新增“卡片 / 地图”切换。进入“事实核对 → 场景 → 地图”创建地图。
每组可保存多张地图，新建时可选放入全部场景，仅排列、不自动连线。
资料栏支持拖入或点击加号放置场景、人物和线索；同一事实可放在多图中。
滚轮缩放，空白处拖动平移，Shift 多选/框选；支持尺寸、颜色、复制、对齐、吸附、锁定及撤销/重做。
连接工具依次选择两个场景，设置门/楼梯等类型、端点、折点、说明和原文引文。
连接默认 KP 自定义，来源引文逐字核对；地图编辑不改变原事实确认或玩家批准。
底图可导入本地 PNG/JPEG/WebP，或从当前 PDF 选择页码并拖动裁切。
可调整底图位置、大小、旋转和透明度；替换底图保留标记坐标。
底图在本机处理，不发送模型；输入不超过 25 MB，保存归一化 PNG 最长边 4096/800 万像素、6 MB 以内。
单项目底图含旧图片共 80 MB；每组最多 100 张地图，单图 2000 标记、4000 连接。
地图及底图随项目备份恢复，可导出 KP PNG；编辑撤销栈仅当前会话保留。
首版不自动识别地点位置，不推断通道，不提供真实比例尺或建筑墙体绘制。
0.9.3 五面墙支持“调整位置”：拖到另一张卡片上，或依次点击两张卡片交换位置。
调整时暂停悬停放大；目标卡高亮，按 Esc 取消当前选择，再按 Esc 或点“完成调整”退出。
排列按模组、提取记录、墙分别保存；重开软件、导出完整备份和恢复后保留。
筛选后只交换选中的两张卡，隐藏卡保留原来的顺序。换位不会改动正文、确认或备团包。
0.9.2 将最终复核改为合并后的卡片分组，每批最多 6 张，只返回问题清单。
复核不再重写、增删卡片或输出完整数值表；已有事实正文和引文保留。
新任务自动按卡片分组；旧任务点击一次“继续剩余批次”后，只重排未完成的复核步骤并顺序执行。
复核会新增多个模型请求，计划总批数随卡片数量变化，不代表成功批次丢失或重跑。
旧 22 批成功 / 119 张卡的隔离模拟续跑已通过，真实任务没有在诊断时被重发。
0.9.1 修正详细提取/查漏反复发送全文的问题，按目标段、邻近资料和有限跨页引用处理，保留全局索引。
输出截断后手动“继续剩余批次”，支持把单个资料块再拆成原文片段，保留原引用编号和成功批次。
原失败任务可直接继续，不必重新提取整个模组；拆分后计划批数可能增加。
新增明确错误原因：输出截断、其他异常结束、空响应、JSON 错误、结构校验、网络异常与超时。
失败请求若返回用量，会保存并显示；未返回用量不表示没有费用。不会自动重发付费请求。
0.9.0 每面墙新增“自定义事实”，保存到当前记录，标记 KP 修改并待确认。
人物墙可按 NPC、敌人、待分类筛选；旧卡在编辑中自行分类，不猜测立场。
卡片展开后按属性、派生、技能、战斗、能力等列表显示数值；编辑支持每行“分组 | 名称 | 数值”。
新提取使用完整性策略 3，不再暗示真相限于 3–7 条，覆盖有用配角、敌人、怪物与独立数值模板。
详细提取后新增逐段查漏，含额外模型请求，提交前显示完整批次数；不自动替已有项目重提。
旧兼容记录不再只保留最近 8 条，多组独立保存；12 组保存、恢复与切换已验证。
新提示词及结构化数值需要新建提取任务；旧卡正文中明确的 STR/HP/DB 等数值可本地显示，不改正文。
逐字引文与数值出处继续校验，数值对应的角色/字段及条件仍需 KP 核对。
0.8.0 每次提取生成独立记录，证据墙顶部可按记录切换。
不同组的同名卡片不互相去重、覆盖或替换；同次继续和重复导入仍属于原组。
每组单独确认、编辑、玩家批准及生成备团包，切换时保留各组快照。
旧卡片按原提取编号分组，确认和编辑保留。旧版混合备团包需按组重新生成，原快照保留在项目资料内。
真相、人物、场景、线索、时间线并列，分类显示已确认/总数，可直接跳到待确认资料。
旧版因跨组去重而跳过的条目，可从原提取草稿补入相应组，无须重发 AI 请求。
提取记录显示时间、模型、任务编号及本组确认进度。
0.7.1 增加逐条校验说明：查看具体标题、问题、批次和出处。
能唯一核对的空格、换行和出处编号差异会自动校正；没有原文依据的内容仍待核对。
提取完成或停止后可点击“校对这条草稿”，本地校对并恢复为待确认草稿，不再次调用 AI。
背景梳理、已恢复及重复校验记录不再混入当前待核对计数。旧版未保存的失败正文无法还原。
点击提取任务侧栏以外的区域、再次点击任务条或按 Esc 均可收起，不中断后台提取。
分批完成后合并同名人物/地点，保留多页出处，并复核非必要真相和错误场景分类。
新任务在最终复核完成后统一加入证据墙，途中可预览。旧任务继续兼容原逻辑。
新提示词只影响新建提取任务；旧事实与已确认卡片不会被自动改写，请重新提取查看新结果。
所有子窗口使用同一淡棕背景，主窗口不再因打开弹窗而整体变色。
证据墙改为错落纸张，默认只显示标题，悬停或键盘聚焦展开。
处理分为全局梳理、详细提取、跨章核对，按模型预算分批。
提取时可以继续阅读、编辑、切换模组。完成只提示，不会自动打开窗口。
底部任务条可查看进度、停止及继续。停止前发出的请求仍可能计费。
失败保留已完成批次；重试输出截断的批次时会缩小该批范围。
最小化后继续；退出软件保存检查点，下次打开后手动继续。
完整项目备份包含提取草稿与任务进度，不包含密钥。
结果只生成草稿；加入证据墙仍需手动确认，不会批准给玩家。

项目资料保存在 %APPDATA%\KeeperPrepDesk。
替换程序文件夹不会删除项目；请使用 .kpproj 导出完整项目备份。
本版没有自动更新。更新时关闭旧版，解压新版后打开即可。

0.12.0 仅执行描述扩写与保存相关的定向检查，未重复整套回归。
界面回归使用 25392 字符的测试正文和本地模拟响应，验证编辑、切换项目、来源校验、完成提醒、独立提取、分组备团快照、时间线确认、自定义卡片、人物分类/数值列表、十二组切换、单块截断后手动继续、旧 22 批任务的分组最终复核及证据墙换位、筛选与保存、地图拖放/缩放、关系引文、PDF 裁切、图片导入、导出和多图恢复。
带团预览已验证拖动与快捷键不修改布局、跨地图浏览位置、搜索与相邻跳转、原文查看、展开/收起及字号设置与 PNG 导出。
未执行真实的 DeepSeek 付费全文提取；真实提取质量需用自己的模组和密钥核对。
'@
$guidePath = Join-Path $releaseRoot ('使用说明-' + $releaseVersion + '.txt')
[System.IO.File]::WriteAllText($guidePath, $guide, [System.Text.UTF8Encoding]::new($true))
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in Get-ChildItem -LiteralPath $sourceRoot -Recurse -File -Force) {
    $relative = $file.FullName.Substring($sourceRoot.Length + 1).Replace('\', '/')
    if ($relative.StartsWith('.vs/') -or $relative -eq 'resources/default_app.asar') { continue }
    if ($relative -match '(^|/)(\.env[^/]*|openai-key\.dat|deepseek-key\.dat|original\.pdf|test-user|\.runtime)(/|$)') {
      throw '发现不应打包的本地资料。'
    }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, ('KP备团台/' + $relative), [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $guidePath, 'KP备团台/使用说明.txt', [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
} finally { $zip.Dispose() }
$verifyZip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $names = @($verifyZip.Entries | ForEach-Object { $_.FullName })
  foreach ($required in @('KP备团台/KP备团台.exe', 'KP备团台/resources/app.asar', 'KP备团台/使用说明.txt')) {
    if ($names -notcontains $required) { throw "发布包缺少文件：$required" }
  }
  if ($names | Where-Object { $_ -match '(^|/)(\.vs|\.env[^/]*|openai-key\.dat|deepseek-key\.dat|original\.pdf|test-user|\.runtime)(/|$)' }) { throw '发布包包含私人或开发文件。' }
  [pscustomobject]@{ File=$zipPath; Entries=$names.Count; SizeMB=[math]::Round((Get-Item -LiteralPath $zipPath).Length/1MB, 1); Verified=$true } | ConvertTo-Json -Compress
} finally { $verifyZip.Dispose() }
