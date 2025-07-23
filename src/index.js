// SynClub MCP Server (JavaScript version)
// ---------------------------------------------------------------
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ResourceLinkSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const {
  SynclubAPIClient,
  SynclubAuthError,
  SynclubRequestError,
  SynclubAPIError,
} = require('./client');
const axios = require('axios');

console.error('### Synclub MCP JS started at', new Date().toISOString());

// Init API client
const API_KEY = process.env.SYNCLUB_MCP_API;
if (!API_KEY) {
  console.error('[synclub-mcp] 环境变量 SYNCLUB_MCP_API 未设置');
}
const API_HOST = process.env.UNIFIED_API_BASE_URL;
const apiClient = new SynclubAPIClient(API_KEY, API_HOST);

// helper to collect SSE stream
async function collectSSE(endpoint, payload) {
  const url = `${API_HOST}${endpoint}`;
  const res = await axios.post(url, payload, { responseType: 'stream', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY }});
  return new Promise((resolve, reject) => {
    let buffer = '';
    res.data.on('data', (chunk) => {
      const lines = chunk.toString('utf8').split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const obj = JSON.parse(line.slice(6));
            const content = obj?.data?.content;
            if (content) buffer += content;
          } catch {}
        }
      }
    });
    res.data.on('end', () => resolve(buffer));
    res.data.on('error', (e) => reject(e));
  });
}

// Create server
const server = new Server(
  { name: 'synclub-mcp', version: '0.6.0' },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

// Replace entire TOOLS array with corrected schemas
const TOOLS = [
  {
    name: 'gbu_generate_comic_story',
    description: `Generate a comic story based on topic input using streaming response.

    COST WARNING: This tool makes an API call which may incur costs. Only use when explicitly requested by the user.

    Args:
        topic_input (str): The topic or theme for the comic script to generate (supports Japanese).
                          Example: "海をテーマにしたシナリオをください" (Please provide a scenario themed around the ocean)

    Returns:
        TextContent: Contains the generated comic script content
    `,
    inputSchema: {
      type: 'object',
      properties: {
        topic_input: { 
          type: 'string', 
          description: 'The topic or theme for the comic script'
        },
      },
      required: ['topic_input'],
    },
  },
  {
    name: 'gbu_generate_comic_chapters',
    description: `Generate comic story chapters based on novel input, character info and chapter number.

    COST WARNING: This tool makes an API call which may incur costs. Only use when explicitly requested by the user.

    Args:
        input_novel (str): The novel input, required.
        chars_info (str or dict): The characters info. Supports both dictionary objects and JSON strings.
            Example: {"char1": {"name": "Jack", "gender": "male"}, "char2": {"name": "Mary", "gender": "female"}}
        chapters_num (int): The number of chapters to generate, default is 4, max is 15.

    Returns:
        TextContent: Contains the generated comic story chapters content
    `,
    inputSchema: {
      type: 'object',
      properties: {
        input_novel: { 
          type: 'string', 
          description: 'The novel content to generate chapters from'
        },
        chars_info: { 
          type: 'string', 
          description: 'Character information in JSON format'
        },
        chapters_num: { 
          type: 'number', 
          description: 'Number of chapters to generate', 
          default: 4 
        },
      },
      required: ['input_novel', 'chars_info'],
    },
  },
  {
    name: 'gbu_generate_comic_image_prompts',
    description: `Generate image prompts based on comic story chapter and character info.

    COST WARNING: This tool makes an API call which may incur costs. Only use when explicitly requested by the user.

    Args:
        input_chapters (str or dict): The comic story chapter input, required.
        chars_info (str or dict): The characters info. Supports both dictionary objects and JSON strings.
                          Example: {"char1": {"name": "Jack", "gender": "male"}, "char2": {"name": "Mary", "gender": "female"}}
    Returns:
        TextContent: Contains the generated image prompts content
    `,
    inputSchema: {
      type: 'object',
      properties: {
        input_chapters: { 
          type: 'string', 
          description: 'Chapter content in JSON format'
        },
        chars_info: { 
          type: 'string', 
          description: 'Character information in JSON format'
        },
      },
      required: ['input_chapters', 'chars_info'],
    },
  },
  {
    name: 'gbu_edit_comic_story',
    description: `Edit comic story based on edit prompt and input story.

    COST WARNING: This tool makes an API call which may incur costs. Only use when explicitly requested by the user.

    Args:
        edit_prompt (str): The edit prompt for the comic story, required.
        input_story (str or dict): The input story, required. Including story content and story title.
                          Format example: {"story_title": "xxx", "story": "xxx"}
                          
    Returns:
        TextContent: Contains the generated comic story content
    `,
    inputSchema: {
      type: 'object',
      properties: {
        edit_prompt: { 
          type: 'string',
          description: 'Edit instructions describing how to modify the story'
        },
        input_story: { 
          type: 'string',
          description: 'Story content to be edited'
        },
      },
      required: ['edit_prompt', 'input_story'],
    },
  },
  {
    name: 'gbu_edit_comic_chapters',
    description: `Edit comic chapters based on edit prompt and input chapters.

    COST WARNING: This tool makes an API call which may incur costs. Only use when explicitly requested by the user.

    Args:
        edit_prompt (str): The edit prompt for the comic chapters, required.
        input_chapters (str or dict): The input chapters, required. Format example:
          {"title": "chapter_title", "chapter_image": {"1": {"description": "scene_desc", "dialogue": [{"name": "char_name", "text": "dialogue_text"}], "aside": "aside_text"}}}
                          
    Returns:
        TextContent: Contains the generated comic chapters content
    `,
    inputSchema: {
      type: 'object',
      properties: {
        edit_prompt: { 
          type: 'string',
          description: 'Edit instructions describing how to modify the chapters'
        },
        input_chapters: { 
          type: 'string',
          description: 'Chapter content to be edited'
        },
      },
      required: ['edit_prompt', 'input_chapters'],
    },
  },
  {
    name: 'gbu_ugc_tti',
    description: `Generate an anime character based on a text prompt.

    COST WARNING: This tool makes an API call which may incur costs. Only use when explicitly requested by the user.

    Args:
        prompt (str): The prompt describing the anime character to generate (English only).
        gender (int): The gender of the anime character to generate. 0-male, 1-female, 2-other
        model_style (str): The style of the comic image. Values: ["Games", "Series", "Manhwa", "Comic", "Illustration"]
            Notes: Each model_style corresponds to:
            - Games (游戏 / ゲーム)
            - Series (番剧 / TVアニメ)
            - Manhwa (韩漫 / 韓国漫画)
            - Comic (漫画专用 / カラフル)
            - Illustration (插画 / イラスト)

    Returns:
        task_id (str): The task ID of the anime character generation task
    `,
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { 
          type: 'string',
          description: 'Character description (English only)'
        },
        gender: { 
          type: 'number',
          description: 'Character gender (0-male, 1-female, 2-other)'
        },
        model_style: { 
          type: 'string',
          description: 'Art style for the character'
        },
      },
      required: ['prompt', 'gender', 'model_style'],
    },
  },
  {
    name: 'gbu_anime_pose_align',
    description: `Generate a pose align image based on an anime character image.

    COST WARNING: This tool makes an API call which may incur costs. Only use when explicitly requested by the user.

    Args:
        image_url (str): The URL of the character image.

    Returns:
        task_id (str): The task ID of the pose align image generation task
    `,
    inputSchema: {
      type: 'object',
      properties: {
        image_url: { 
          type: 'string',
          description: 'URL of the character image to align'
        },
      },
      required: ['image_url'],
    },
  },
  {
    name: 'gbu_anime_comic_image',
    description: `Generate a comic image based on prompt and character settings.

    COST WARNING: This tool makes an API call which may incur costs. Only use when explicitly requested by the user.

    Args:
        prompt (str): The prompt for the comic image (English only).
        scene_type (str): The scene type. Values: ["nc", "single", "double"]
            nc - no character
            single - single character
            double - double character
        char1_image (str): URL of character1's pose-aligned image. Required even for nc type.
        char2_image (str): URL of character2's pose-aligned image. Empty for nc/single types.
        char1_gender (str): Gender of character1. Values: ["0", "1"] (0-male, 1-female)
        char2_gender (str): Gender of character2. Values: ["0", "1"]. Empty for nc/single types.
        model_style (str): Art style. Values: ["Games", "Series", "Manhwa", "Comic", "Illustration"]

    Returns:
        task_id (str): The task ID of the comic image generation task
    `,
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { 
          type: 'string',
          description: 'Scene description (English only)'
        },
        scene_type: { 
          type: 'string',
          description: 'Scene type (nc/single/double)'
        },
        char1_image: { 
          type: 'string',
          description: 'URL of first character image'
        },
        char2_image: { 
          type: 'string',
          description: 'URL of second character image'
        },
        char1_gender: { 
          type: 'string',
          description: 'Gender of first character'
        },
        char2_gender: { 
          type: 'string',
          description: 'Gender of second character'
        },
        model_style: { 
          type: 'string',
          description: 'Art style for the image'
        },
      },
      required: ['prompt', 'scene_type', 'char1_image', 'char1_gender', 'model_style'],
    },
  },
  {
    name: 'gbu_flux_edit_image',
    description: `Edit image based on image url and prompt.

    COST WARNING: This tool makes an API call which may incur costs. Only use when explicitly requested by the user.

    Args:
        image_url (str): The URL of the image to edit.
        image_prompt (str): The prompt describing how to edit the image. Only supports English.
            Format: 
            1. Clearly specify elements to remove
            2. Clearly specify elements to keep
            3. Describe replacement background details
            4. Mention key visual elements like horizon, lighting
            Example: "Remove [elements], replace with [new elements], keep [elements], [additional details]"

    Returns:
        TextContent: Contains the edited image URL or task status.
    `,
    inputSchema: {
      type: 'object',
      properties: {
        image_url: { 
          type: 'string',
          description: 'The URL of the image to edit'
        },
        image_prompt: { 
          type: 'string',
          description: 'The prompt describing how to edit the image (English only)'
        },
      },
      required: ['image_url', 'image_prompt'],
    },
  },
];

// 工具到后端 API 路径映射
const ENDPOINT_MAP = {
  generate_comic_story: '/pulsar/mcp/inner/comic/generate_script',
  generate_comic_chapters: '/pulsar/mcp/inner/comic/generate_storyboards',
  generate_comic_image_prompts: '/pulsar/mcp/inner/comic/prompt_format',
  edit_comic_story: '/pulsar/mcp/inner/comic/edit_script',
  edit_comic_chapters: '/pulsar/mcp/inner/comic/edit_storyboards',
  ugc_tti: '/pulsar/mcp/inner/comic/generate_role',
  anime_pose_align: '/pulsar/mcp/inner/comic/pose_straighten',
  anime_comic_image: '/pulsar/mcp/inner/comic/generate_comic',
  flux_edit_image: '/pulsar/mcp/inner/comic/edit',
};
// tools/list handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

// tools/call handler (generic)
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    const endpoint = ENDPOINT_MAP[name];
    if (!endpoint) {
      throw new Error(`No endpoint mapping for tool ${name}`);
    }
    let payload = args;
    if (name === 'gbu_generate_comic_image_prompts') {
      const { input_chapters, chars_info } = args;
      if (!input_chapters || !chars_info) {
        throw new Error('input_chapters 和 chars_info 均为必填');
      }
      payload = {
        input_chapter: typeof input_chapters === 'string' ? input_chapters : JSON.stringify(input_chapters),
        chars_info: typeof chars_info === 'string' ? chars_info : JSON.stringify(chars_info),
      };
    }
    if (name === 'gbu_generate_comic_chapters') {
      const { input_novel, chars_info, chapters_num } = args;
      if (!input_novel || !chars_info) {
        throw new Error('input_novel 和 chars_info 必填');
      }
      payload = {
        input_novel,
        chars_info: typeof chars_info === 'string' ? chars_info : JSON.stringify(chars_info),
        chapter_num: chapters_num ?? 4,
      };
    }
    if (name === 'gbu_generate_comic_story') {
      let { topic_input, theme } = args;
      topic_input = topic_input || theme;
      if (!topic_input) throw new Error('topic_input 必填');
      payload = { topic_input };
      // use SSE aggregation
      const script = await collectSSE(endpoint, payload);
      return { content: [{ type: 'text', text: script }], isError: false };
    }
    if (name === 'gbu_edit_comic_story') {
      const { edit_prompt, input_story } = args;
      if (!edit_prompt || !input_story) throw new Error('edit_prompt 和 input_story 必填');
      payload = { 
        edit_prompt, 
        story_input: input_story
      };
      // use SSE aggregation
      const script = await collectSSE(endpoint, payload);
      return { content: [{ type: 'text', text: script }], isError: false };
    }
    if (name === 'gbu_edit_comic_chapters') {
      const { edit_prompt, input_chapters } = args;
      if (!edit_prompt || !input_chapters) throw new Error('edit_prompt 和 input_chapters 必填');
      payload = { 
        edit_prompt, 
        chapters_description_input: input_chapters
      };
      // use SSE aggregation
      const script = await collectSSE(endpoint, payload);
      return { content: [{ type: 'text', text: script }], isError: false };
    }
    if (name === 'gbu_flux_edit_image') {
      const { image_url, image_prompt } = args;
      if (!image_url || !image_prompt) throw new Error('image_url 和 image_prompt 必填');
      
      payload = { 
        image_url, 
        edit_prompt: image_prompt
      };
      
      const resp = await apiClient.post(endpoint, { data: payload });
      
      // 获取task_id并开始轮询
      const taskId = resp?.data?.task_id;
      if (!taskId) {
        throw new Error(`task_id is required, response_data: ${JSON.stringify(resp)}`);
      }
      
      // 轮询任务状态
      for (let i = 0; i < 20; i++) {
        await new Promise(res => setTimeout(res, 5000));
        
        const statusResp = await apiClient.post('/pulsar/mcp/inner/comic/query_task', { 
          data: { task_id: taskId }
        });
        
        const errno = statusResp?.errno;
        if (errno === 0) {
          // 处理图片数据
          const imgData = statusResp?.data?.img_data;
          if (imgData && Array.isArray(imgData) && imgData.length > 0) {
            const images = imgData[0].images || [];
            const urls = [];
            for (const img of images) {
              const url = img.webp || img.url || img;
              if (url) {
                urls.push(url);
              }
            }
            
            return {
              content: [{
                type: 'text',
                text: urls.join('\n')
              }],
              isError: false
            };
          }
        }
        
        // 如果任务失败
        if (errno && errno !== 0 && errno !== 2200) {
          throw new Error(`Task failed for task_id: ${taskId}`);
        }
      }
      
      throw new Error(`Task did not complete in time for task_id: ${taskId}`);
    }
    // Tools that stream responses but we want aggregated output
    if (['gbu_generate_comic_story', 'gbu_generate_comic_image_prompts', 'gbu_generate_comic_chapters', 'gbu_edit_comic_story', 'gbu_edit_comic_chapters'].includes(name)) {
      const textResult = await collectSSE(endpoint, payload);
      return { content: [{ type: 'text', text: textResult }], isError: false };
    }

    const resp = await apiClient.post(endpoint, { data: payload });

    // story 任务可能返回 task_id，需要轮询
    if (name === 'gbu_generate_comic_story') {
      if (resp?.data?.task_id) {
        const taskId = resp.data.task_id;
        const queryEndpoint = '/pulsar/mcp/inner/comic/query_task';
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const status = await apiClient.post(queryEndpoint, { data: { task_id: taskId } });
          if (status?.errno === 0 && status?.data?.content) {
            resp = status;
            break;
          }
          if (status?.errno && status.errno !== 0 && status.errno !== 2200) {
            throw new Error(status.err_msg || 'Task failed');
          }
        }
      }
    }
    // 需要轮询查询任务的工具
    if (['anime_comic_image', 'anime_pose_align', 'ugc_tti', 'flux_edit_image'].includes(name)) {
      // 如果直接带 img_data 则解析
      const processImgData = (imgData) => {
        const urls = [];
        for (const item of imgData) {
          const images = item.images || [];
          for (const img of images) {
            const url = img.webp || img.url || img;
            if (url) {
              urls.push(url);
            }
          }
        }
        return urls.join('\n');
      };

      let imgData = resp?.data?.img_data ?? resp?.img_data;
      if (!imgData) {
        // 无图片，尝试轮询 query_task
        const taskId = resp?.data?.task_id;
        if (taskId) {
          const queryEndpoint = '/pulsar/mcp/inner/comic/query_task';
          for (let i = 0; i < 30; i++) {
            await new Promise((res) => setTimeout(res, 2000));
            const statusResp = await apiClient.post(queryEndpoint, { data: { task_id: taskId } });
            if (statusResp?.errno === 0 && statusResp?.data?.img_data) {
              imgData = statusResp.data.img_data;
              break;
            }
            // 如果任务失败
            if (statusResp?.errno && statusResp.errno !== 0 && statusResp.errno !== 2200) {
              throw new Error(statusResp.msg || 'Task failed');
            }
          }
        }
      }

      if (imgData) {
        const textUrls = processImgData(imgData);
        if (textUrls) {
          return { content: [{ type: 'text', text: textUrls }], isError: false };
        }
      }
    }
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(resp),
        },
      ],
      isError: false,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `调用失败: ${msg}`,
        },
      ],
      isError: true,
    };
  }
});

// Generic handleRequest for compatibility
const HandleRequestSchema = z.object({
  jsonrpc: z.literal('2.0').optional(),
  id: z.number().optional(),
  method: z.literal('handleRequest'),
  params: z.object({
    method: z.enum(['GET', 'POST']),
    path: z.string(),
    headers: z.record(z.string()).optional(),
    body: z.any().optional(),
    query: z.record(z.any()).optional(),
  }),
});

server.setRequestHandler(HandleRequestSchema, async (req) => {
  const { method, path, headers = {}, body, query = {} } = req.params;
  try {
    if (method === 'GET') return await apiClient.get(path, { params: query, headers });
    if (method === 'POST') return await apiClient.post(path, { data: body, headers });
    throw new Error(`Unsupported HTTP method: ${method}`);
  } catch (err) {
    if (err instanceof SynclubAPIError) throw new Error(err.message);
    throw new Error(`API request failed: ${err.message}`);
  }
});

// Connect transport
(async () => {
  try {
    await server.connect(new StdioServerTransport());
  } catch (e) {
    console.error('[synclub-mcp] Failed to start server', e);
    process.exit(1);
  }
})();

// keep alive
setInterval(() => {}, 1 << 30);

process.on('uncaughtException', (e) => console.error('Uncaught:', e));
process.on('unhandledRejection', (r) => console.error('Unhandled Rejection:', r)); 