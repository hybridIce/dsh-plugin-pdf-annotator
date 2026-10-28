# PDF 批注 · DeepSeek Harness 插件

在 PDF 中选中句子、添加批注，再把多条批注一起交给 Agent 处理。

A DeepSeek Harness plugin for selecting PDF text, adding comments, and sending them as a batch.

## 功能

- **选句批注**：拖选 PDF 文字，添加批注或仅引用原文。
- **高亮与定位**：批注显示为高亮和编号，可在列表中定位、编辑、删除。
- **批量发送**：攒好几条后一次提交；确认接收后清除已发送的批注，失败时保留。
- **配合草稿使用**：批注可追加到输入框末尾，保留原有文字和引用；也可直接发送这批批注。
- **本地保存**：按会话和文件保存批注，保存失败时提示并支持重试。
- **阅读工具**：缩放、适应宽度、中英文界面，以及跨行文本整理。

## 安装

需要 DeepSeek Harness **0.2.1-rc.3 或更新的 0.2.x 版本**。Harness 仍处于开发预览阶段，后续接口变化可能影响兼容性。

### 在 App 的「发现」页安装

1. 打开 **插件 → 实验性插件 → 更多**，启用 **自定义插件索引**（部分版本名称为 **自定义插件市场**）。
2. 切换到 **发现 → 添加索引源**，粘贴以下地址：

   ```text
   https://raw.githubusercontent.com/hybridIce/dsh-plugin-pdf-annotator/main/index.json
   ```

3. 选择 **PDF 批注 · 社区插件** 索引，打开 **PDF 批注** 卡片，点击 **安装**并确认来源。
4. 安装后启用插件，打开 PDF，在预览头部选择 **PDF 批注** 查看器。

索引支持中英文名称和介绍。添加一次后即可从「发现」页浏览版本和安装；如果已经安装，卡片会显示 **已安装**。

English: Enable the custom plugin index bundle, open **Discover**, and add the URL above. Select **PDF Annotator** to view its details and install.

### 从 GitHub 安装

1. 打开 Harness 的 **插件 → 添加插件 → 安装第三方插件**。
2. 输入仓库地址：

   ```text
   https://github.com/hybridIce/dsh-plugin-pdf-annotator
   ```

3. 安装后启用 **PDF 批注**。如果应用提示需要重启，请先完成正在运行的任务，再重启。
4. 打开 PDF，在预览头部选择 **PDF 批注** 查看器。

仓库包含编译后的插件文件，安装时无需手动构建。

### 从安装包安装

在 [Releases](https://github.com/hybridIce/dsh-plugin-pdf-annotator/releases) 下载 `dsh-plugin-pdf-annotator-0.1.2.tgz`，保存到固定位置，再在“添加插件”中输入安装包的完整路径。

也可在完全退出桌面版后使用 macOS 自带命令行：

```sh
"/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" plugin --profile desktop add /path/to/dsh-plugin-pdf-annotator-0.1.2.tgz
```

Web 版使用对应的 profile，例如 `dsh plugin --profile web add /path/to/dsh-plugin-pdf-annotator-0.1.2.tgz`。

## 使用

1. 打开 PDF，拖选一句或一段文字。
2. 点击 **添加批注**，写下要求并保存；不需要评论时选择 **仅引用**。
3. 继续选择其他位置，批注会汇总到列表。
4. 选择一种提交方式：
   - **插入输入框**：把批注追加到当前草稿，可以补充总体要求后一起发送。
   - **立即发送**：只提交这批批注，输入框原有草稿和附件保留。

发送给 Agent 的内容包含文件路径、页码、所选原文和你的批注。正在发送时新增或修改的批注会保留，供下一次提交。

## 说明

- 文字选择依赖 PDF 的文本层；没有文本层的扫描件需要先做 OCR。
- 批注保存在 Harness 的本地应用存储中，不会写回原 PDF，也不会自动跨设备同步。
- 需要密码的 PDF 暂不支持。
- 如需使用 Harness 内置查看器，可在预览头部的查看器菜单中切换。

## 开发

```sh
npm ci
npm run typecheck
npm test
npm run build
npm pack
```

主要目录：

```text
src/client/annotations/   批注存储与持久化
src/client/chat/          消息格式、草稿追加与批量发送
src/client/viewer/        PDF 渲染、选区、高亮与批注界面
scripts/build.mjs        构建与打包
tests/                   逻辑测试
```

## 许可证

本插件使用 [MIT 许可证](LICENSE)。随插件分发的 PDF.js、字体和解码器的许可信息见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
