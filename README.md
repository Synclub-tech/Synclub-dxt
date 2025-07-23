
# MCP-SynClub-Generate-Comic -Claude-dxt

Designed specifically for comic creation, MCP-SynClub-Generate-Comic integrates the full creative workflow, including scriptwriting, character image generation, and storyboard creation.

You can install **MCP-SynClub-Generate-Comic** on Claude Desktop with a single click using the `.dxt` Desktop Extension.

## Core  Features

- 🔖 **Script Generation**
- 🧑‍🎨 **Character Image Generation**
- 📖  **Storyboard Creation**
- 🖼️ **Comic Generation**

## Installation-For Claude Desktop

* **How to get the .dxt file**

```
git clone https://github.com/520chatgpt01/Synclub-dxt
cd synclub-dxt
npm install
npm install -g @anthropic-ai/dxt
dxt pack
```

* **How to use the .dxt file**

```bash
1. Open Claude Desktop  
2. Go to Settings → Extensions → Browse Extensions → Desktop Extensions → Advanced Settings
3. Click "Install Extension" and select the `.dxt` file  
4. Enter the API key obtained from https://www.synclubmcp.com/
5. Go to Settings → Developer → synclub-dxt, if it shows **"running"**, the installation was successful
```

## Usage Guide

### 🔖Step 1 - Script Generation

- **Description**: Generates a comic script from input themes and a plot summary. The result can be refined through additional instructions if needed.
- **Prompt Input**
  - **Tips**: You can provide your prompt as a simple sentence or in a structured format.
  - **Examples**:
    - **One-sentence description**: "A high school love story with a cool, academic female lead and a sunny, handsome athlete."
    - **Structured format example**:
      - Scene: A mountaintop villa
      - Weather: Blizzard
      - Plot: An overbearing CEO (A) meets a little girl (B) in need of help, and they eventually fall in love.
- **Output Example**:
  ![Script Generation](https://github.com/520chatgpt01/Synclub-dxt/raw/main/image/1-%E5%89%A7%E6%9C%AC%E7%94%9F%E6%88%90.png)
  ![Script Editing](https://github.com/520chatgpt01/Synclub-dxt/raw/main/image/2-%E5%89%A7%E6%9C%AC%E7%BC%96%E8%BE%91.png)

### 🧑‍🎨 Step 2-Character Image Generation

- **Description**: Generate character images based on user-provided appearance descriptions, character gender, and a selected base style. Results can be further refined with additional instructions.
- **Base Style Selection**: Choose from five base styles (Korean manhwa, game, illustration, anime, manga) via user input.
- **Prompt Example**: "I want an illustration-style image. The female lead has long, wavy brown hair with bangs and fair skin. The male lead is muscular, with tanned skin and a cheerful smile."
- **Output Example**:
  ![Character Image Generation](https://github.com/520chatgpt01/Synclub-dxt/raw/main/image/2-%E8%A7%92%E8%89%B2%E5%BD%A2%E8%B1%A1%E7%94%9F%E6%88%90.png)

![Male Character](https://github.com/520chatgpt01/Synclub-dxt/raw/main/image/%E7%94%B7%E4%B8%BB%E5%BD%A2%E8%B1%A1.webp)

![Female Character](https://github.com/520chatgpt01/Synclub-dxt/raw/main/image/%E5%A5%B3%E4%B8%BB%E5%BD%A2%E8%B1%A1.webp)

### 📖 Step 3 - Text Storyboard Creation

- **Description**:
  Based on the finalized script (Step 1) and character information (Step 2), this step generates detailed text storyboards for 4 to 15 chapters. Each storyboard includes scene descriptions, character dialogues, and narration.
  If any parts of the storyboard are unsatisfactory, you can fine-tune them through natural language instructions.
- **Prompt Input Tips**:

  - **No Character Scene**
    Focus on describing the setting: environment, weather, time of day, atmosphere, etc.
  - **Single Character Scene**
    Describe the character's actions, facial expressions, surroundings, camera movement, and angles.
  - **Dual Character Scene**
    Describe both characters' actions, interactions, setting, camera movement, and perspective.
- **Output Example**:

  - **Chapter 1: The Promise of Cherry Blossoms**
  - **Description**: A classroom bathed in the warmth of spring. Cherry blossom petals flutter outside the window.
  - **Dialogue**:
    - **Yota Sato**: "Hey, Takahashi-san, want to walk home together after school?"
    - **Misaki Takahashi**: "I have studying to do."
  - **Narration**: A fleeting glance at her fingertips.

### 🖼️ Step 4 - Comic Image Generation

* **Description**:
  Based on the character information from Step 2 and the text storyboards from Step 3, this step generates multiple comic-style images according to the number of chapters.
  If needed, the generated images can be further refined using natural language instructions.
* **Supported Edits**:
  You can make detailed adjustments to elements such as colors, hairstyles, facial expressions, and more.
  Simply describe what you want to change. For example:

  * “Change hair color to brown”
  * “Make the shirt white”

- **Output Example**:

![Panel Generation](https://github.com/520chatgpt01/Synclub-dxt/raw/main/image/4-%E5%9B%BE%E7%89%87%E5%88%86%E9%95%9C%E7%94%9F%E6%88%90.png)
![Chapter 1 Comic Page](https://github.com/520chatgpt01/Synclub-dxt/raw/main/image/%E7%AC%AC%E4%B8%80%E7%AB%A0%E5%9B%BE%E7%89%87.webp)

### Project Structure

```
Synclub-mcp-server-dxt/
├── src/                   # Source code directory
│   ├── index.js           # Main entry file, Contains the implementation of all tools
│   └── client.js          # API client implementation
│
├── image/                 # Directory for images used in documentation and examples
│
├── node_modules/          # Directory for dependencies installed via npm(generated by npm install)
│
├── package.json           # Project configuration file, defines dependencies, scripts, and metadata
├── package-lock.json      # Dependency lock file to ensure consistent version installation
├── manifest.json          # MCP server configuration file that defines凭 available tools and features
├── README.md              # Project documentation, including installation and usage instructions
└── LICENSE                # MIT license file
```

## Available Tools

### Core Tools - Essential Tools for Comic Generation

| Tool name                                  | Description                                                                                                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`generate_comic_story`**         | Generates a comic script from input themes and a plot summary.                                                                                              |
| **`generate_comic_chapters`**      | Generates chapter content based on the comic script                                                                                                         |
| **`ugc_tti`**                      | Generates character images.Please describe the you want to generate, such as character actions, expressions, environment, camera movement, and angles, etc. |
| **`anime_pose_align`**             | Aligns the generated character images for the final comic image generation                                                                                  |
| **`generate_comic_image_prompts`** | Generates prompts required for image generation tasks based on chapter content                                                                              |
| **`anime_comic_image`**            | Submits comic image generation tasks based on prompts and returns the task ID                                                                               |

### Advanced Tools - For Modifying Generated Results

| Tool name                         | Description                                                                                                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`edit_comic_story`**    | Edits the generated comic story                                                                                                                                                   |
| **`edit_comic_chapters`** | Edits the generated comic chapters                                                                                                                                                |
| **`flux_edit_image`**     | Edit images from natural language commands. Supported operations include local adjustments (e.g., cropping, color correction), background replacement, style transfers, and more. |

## Requirements

- **Claude Desktop** (Developer Mode enabled)
- **Node.js 14+** (required for building from source)
  - **To confirm your setup:**
    Go to Settings → Extensions → Browse Extensions → Desktop Extensions → Advanced Settings → Detected Tools. If your Node.js version is below 14, please update the Claude client.
- **Supported platforms:** macOS, Windows, Linux

## License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/520chatgpt01/Synclub-dxt/blob/main/LICENSE) file for details.

## From

[https://github.com/520chatgpt01/Synclub-mcp-server](https://github.com/520chatgpt01/Synclub-mcp-server)

**`🎉 Covers the full comic creation workflow, from scriptwriting to comic image generation—ideal for AI-assisted comic creation!`** 🎨✨`<h1 align="center">`SynClub MCP Server `</h1>`
