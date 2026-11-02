# CoC KP Assist Agent · KP 备团台

面向个人守秘人的 Windows 桌面备团与带团工具。当前版本：**0.13.0**。

导入模组、核对事实、整理线索墙和地图，在带团时快速阅读和编辑资料。AI 操作由用户主动发起，使用用户自己配置的 OpenAI 或 DeepSeek API。

## 功能

- **模组书库**：导入 PDF、TXT、Markdown；PDF 文字提取、本地 OCR、导入进度和原文查看。
- **后台 AI 提取**：全文分批提取、来源校验、草稿核对、停止及手动继续；每次提取保存为独立记录。
- **事实核对**：真相、人物、场景、线索、时间线、描述六面墙，纸张卡片悬停展开；支持编辑、删除、自定义事实及事实墙换位。
- **人物资料**：NPC / 敌人分类，属性、技能和战斗数值列表。
- **场景地图**：底图、事实和描述卡片、缩放平移、连接关系、字号、锁定、撤销及 PNG 导出。
- **带团预览**：点击卡片查看完整正文、人物数值和出处，搜索定位；普通点击不改变视角。
- **描述扩写**：输入场景概述，选择氛围和篇幅；生成草稿后由用户采用、编辑和保存。
- **本机保存**：项目历史、完整备份与恢复、KP 手记及逐条批准的玩家材料导出。

0.13.0 扩大了卡片编辑窗口，统一了墙页面布局，并移除了备团包界面和生成入口。旧项目数据保持兼容。

## 本地开发

需要 Windows 10/11 x64、Node.js 和 npm。依赖版本固定在 `package-lock.json`。

```powershell
git clone https://github.com/Kongcheng-084/CocKP_Assist_Agent.git
cd CocKP_Assist_Agent
npm ci
npm start
```

首次安装需要下载 Electron。若安装环境禁用了依赖安装脚本，可手动执行：

```powershell
node node_modules/electron/install.js
```

在应用设置中选择服务商、填写自己的 API Key 并保存。密钥使用 Windows 安全存储加密，不放在源码、项目备份或发布包中。模型和本机代理可在应用设置中调整。

## 打包免安装版

在项目根目录运行：

```powershell
$releaseVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
node node_modules/electron-builder/cli.js --win dir --x64 "--config.directories.output=release/$releaseVersion"
node scripts/verify-release.cjs
.\scripts\package-portable.ps1
```

输出为 `release/KP备团台-<版本>-Windows-x64.zip`。完整解压后打开 `KP备团台.exe`，不要单独移动 EXE。打包脚本不会覆盖同名 ZIP。

## 项目结构

```text
desktop/       Electron 主进程、预加载、本机存储和后台任务
ui/            界面、证据墙、地图、PDF/OCR 及提示词相关逻辑
lib/           AI 提取与描述扩写接口
scripts/       打包、诊断和隔离界面检查
tests/         数据、接口、保存与恢复检查
docs/          开发与版本记录
```

第三方 PDF/OCR 运行组件、语言数据、字体及其许可证保留在 `ui/vendor/`。仓库不包含 `node_modules`、本机模组 PDF、项目备份、API 密钥、临时测试资料和发布程序。

## 检查

按改动范围选择检查，不必每次运行全部测试：

```powershell
# 描述、地图关联、保存与备份
node --test tests/descriptions.test.mjs

# 完整逻辑检查（需要时）
npm test
```

`scripts/test-workspace-ui.mjs` 等界面脚本使用隔离项目；AI 相关界面测试使用本地模拟响应。运行真实 AI 提取或描述扩写时，费用由所选服务商按实际调用计算。

## 数据与使用说明

项目数据位于 `%APPDATA%/KeeperPrepDesk`。关闭旧版并替换程序目录即可升级，项目资料保留。可在书库导出 `.kpproj` 完整备份。

事实与 AI 草稿需要由 KP 核对。描述扩写属于创作内容，不作为模组原文事实；地图预览为 KP 使用。玩家材料只导出用户明确批准的条目。

内置示例与自导入模组的内容、署名和出处应按相应模组说明保留。完整 PDF 和私人备团资料不随源码上传。

详细实现和历史变更见 [开发记录](docs/DEVELOPMENT_HISTORY.md)。
