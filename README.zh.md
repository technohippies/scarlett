# Scarlett Supercoach - 浏览器扩展 (中文)

[![许可：AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
<!-- 稍后添加其他徽章：构建状态、版本等 -->

一款旨在增强语言学习和提高生产力的浏览器扩展，内置人工智能助手 Scarlett Supercoach。

**注意：** 本项目正在积极开发中。

## 功能特性

*   **词汇学习：** 像 Babel 的 Toucan 一样，识别并翻译网页上的单词。
*   **抽认卡：** 使用 `ts-fsrs` 支持的间隔重复系统 (SRS) 创建和复习抽认卡，实现类似 Anki 的调度。
*   **网页剪辑：** 剪辑文本以生成抽认卡和完形填空练习，并可选择进行语言翻译。
*   **书签：** 使用语义嵌入为书签添加功能，让您的浏览器端人工智能了解您的兴趣。
*   **专注模式：** 在学习期间阻止分散注意力的网站，并将分散注意力的网站（社交媒体等）替换为您正在学习的抽认卡。
*   **人工智能集成：**
    *   利用大型语言模型 (LLM) 完成各种任务，如抽认卡生成、翻译和摘要。
    *   与 **Jan.ai**、**Ollama** 和 **LM Studio** 等本地模型提供商集成，允许您运行和管理您偏好的模型。
    *   支持灵活配置，允许您为 LLM 推理、嵌入生成、文本转语音 (TTS) 和文本提取 (阅读器) 混合搭配不同的提供商。
    *   利用 **PGLite** (WASM 中的 PostgreSQL) 和 `pgvector` 支持，在浏览器内直接实现高效的本地 AI 功能。

## 安装方法

### 从源代码安装

1.  克隆仓库：
    ```bash
    git clone https://github.com/technohippies/supercoach.git
    cd supercoach
    ```
2.  安装依赖并构建扩展：
    ```bash
    bun install
    bun run build
    ```
3.  将解压后的扩展加载到您的浏览器中 (支持 **Chrome/Edge** 和 **Firefox**。Safari 支持待定)：
    *   **Chrome/Edge：** 前往 `chrome://extensions/`，启用"开发者模式"，点击"加载已解压的扩展程序"，然后选择 `supercoach/.output/chrome-mv3` 目录。
    *   **Firefox：** 前往 `about:debugging#/runtime/this-firefox`，点击"加载临时附加组件..."，然后选择 `supercoach/.output/firefox-mv2/manifest.json` 文件。

### 从应用商店安装 (即将推出)

Chrome Web Store、Firefox Add-ons 等链接将在发布后添加在此处。

## 使用说明

*(核心功能的使用说明将很快在此处添加。)*

## 开发指南

贡献代码或在本地开发此扩展：

1.  克隆仓库 (如果尚未克隆)：
    ```bash
    git clone https://github.com/technohippies/supercoach.git
    cd supercoach
    ```
2.  安装依赖：
    ```bash
    bun install
    ```
3.  启动开发服务器：
    ```bash
    bun run dev
    ```

## 技术栈

此扩展利用了以下关键技术：

*   **WXT:** 为构建强大的浏览器扩展提供了卓越的开发者体验 (DX)。
*   **SolidJS:** 因其高性能 (约 10KB 运行时)、细粒度响应式以及无虚拟 DOM 的特性而被选中，从而实现了快速响应的 UI，且不会造成浏览器卡顿。
*   **UnoCSS:** 一款原子化 CSS 引擎，相比 Tailwind CSS 等替代方案具有显著的性能优势。
*   **PGLite:** 通过 WebAssembly 在浏览器中直接运行 PostgreSQL，并包含 `pgvector` 支持，以实现本地 AI 功能。
*   **ts-fsrs:** 实现 FSRS 间隔重复算法，用于有效的抽认卡调度。
*   **Storybook:** 广泛用于独立开发、文档化和测试 UI 组件，确保设计一致性。
*   **本地 LLM 提供商:** 特别感谢 **Jan.ai**、**Ollama** 和 **LM Studio** 团队实现了强大的本地 AI 功能。

## 许可信息

本项目采用**双重许可**模式：

1.  **源代码:** 本扩展的源代码采用 **GNU Affero General Public License v3.0 (AGPLv3)** 许可。完整许可文本请参见根目录下的 [LICENSE](./LICENSE) 文件。

2.  **角色资产:** 所有与角色 **"Scarlett Supercoach"** 相关的资产，包括位于 `public/images/scarlett-supercoach/` 目录下的图像、肖像及相关描述，均**明确排除**在 AGPLv3 许可之外。这些资产是受保护的知识产权，并在 Story Protocol 上注册：
    [https://portal.story.foundation/assets/0xf30F18A457d90726ea1f7457242259fd7ec6F285](https://portal.story.foundation/assets/0xf30F18A457d90726ea1f7457242259fd7ec6F285)
    您可以通过上述链接铸造（mint）这些资产的商业使用许可（费用：42 $IP）。具体条款详见 [public/images/scarlett-supercoach/LICENSE](./public/images/scarlett-supercoach/LICENSE) 文件。

**重要提示:** 使用 AGPLv3 许可下的源代码**并不**授予您使用 `public/images/scarlett-supercoach/` 目录中 "Scarlett Supercoach" 角色资产的任何权利。对这些资产的任何使用都必须遵守其相应许可文件中指定的条款或通过 Story Protocol 获取许可。

## 贡献

*(贡献指南将很快在此处添加。)*

---

# Scarlett Supercoach - Browser Extension (Chinese)

This is a placeholder.

Please add the Chinese description for the Scarlett Supercoach browser extension here.

Key sections should include:

*   Project Introduction
*   Features
*   Installation
*   Usage
*   Development Guide
*   Licensing Information (clearly explaining the dual-license model for the code and the Scarlett Supercoach character assets) 
    *   **Source Code:** The source code for this extension is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**. The full text of this license can be found in the [LICENSE](./LICENSE) file in the root directory.
    *   **Character Assets:** All assets pertaining to the character **"Scarlett Supercoach"**, including images, likenesses, and potentially related descriptions located within the `public/images/scarlett-supercoach/` directory, are **explicitly excluded** from the AGPLv3 license. These assets are protected intellectual property registered on Story Protocol:
        [https://portal.story.foundation/assets/0xf30F18A457d90726ea1f7457242259fd7ec6F285](https://portal.story.foundation/assets/0xf30F18A457d90726ea1f7457242259fd7ec6F285)
        A commercial use license can be minted via the link above (cost: 42 $IP). The specific terms are detailed in the [public/images/scarlett-supercoach/LICENSE](./public/images/scarlett-supercoach/LICENSE) file.
    *   **Important:** Use of the source code under the AGPLv3 license **does not** grant any rights to use the "Scarlett Supercoach" character assets found in `public/images/scarlett-supercoach/`. Any use of these assets must comply with the terms specified in their respective license file or obtained via Story Protocol. 