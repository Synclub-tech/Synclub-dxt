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
    description: 'Generate a comic story based on input story theme',
    inputSchema: {
      type: 'object',
      properties: {
        topic_input: { type: 'string', description: 'Story theme/topic' },
      },
      required: ['topic_input'],
    },
  },
  {
    name: 'gbu_generate_comic_chapters',
    description: 'Generate comic story chapters',
    inputSchema: {
      type: 'object',
      properties: {
        input_novel: { type: 'string', description: 'Novel input' },
        chars_info: { type: 'string', description: 'Characters info (JSON string)' },
        chapter_num: { type: 'number', description: 'Number of chapters', default: 4 },
      },
      required: ['input_novel', 'chars_info'],
    },
  },
  {
    name: 'gbu_generate_comic_image_prompts',
    description: 'Generate image prompts for comic chapter',
    inputSchema: {
      type: 'object',
      properties: {
        input_chapters: { type: 'string', description: 'Chapter JSON' },
        chars_info: { type: 'string', description: 'Characters info JSON' },
      },
      required: ['input_chapters', 'chars_info'],
    },
  },
  {
    name: 'gbu_edit_comic_story',
    description: 'Edit comic story',
    inputSchema: {
      type: 'object',
      properties: {
        edit_prompt: { type: 'string' },
        input_story: { type: 'string', description: 'Story JSON' },
      },
      required: ['edit_prompt', 'input_story'],
    },
  },
  {
    name: 'gbu_edit_comic_chapters',
    description: 'Edit comic chapters',
    inputSchema: {
      type: 'object',
      properties: {
        edit_prompt: { type: 'string' },
        input_chapters: { type: 'string', description: 'Chapters JSON' },
      },
      required: ['edit_prompt', 'input_chapters'],
    },
  },
  {
    name: 'gbu_ugc_tti',
    description: 'Generate an anime character based on text prompt',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        gender: { type: 'number' },
        model_style: { type: 'string' },
      },
      required: ['prompt', 'gender', 'model_style'],
    },
  },
  {
    name: 'gbu_anime_pose_align',
    description: 'Generate pose align image',
    inputSchema: {
      type: 'object',
      properties: {
        image_url: { type: 'string' },
      },
      required: ['image_url'],
    },
  },
  {
    name: 'gbu_anime_comic_image',
    description: 'Generate comic image',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        scene_type: { type: 'string' },
        char1_image: { type: 'string' },
        char2_image: { type: 'string' },
        char1_gender: { type: 'string' },
        char2_gender: { type: 'string' },
        model_style: { type: 'string' },
      },
      required: ['prompt', 'scene_type', 'char1_image', 'char1_gender', 'model_style'],
    },
  },
  {
    name: 'gbu_flux_edit_image',
    description: 'Edit image based on prompt',
    inputSchema: {
      type: 'object',
      properties: {
        image_url: { type: 'string' },
        image_prompt: { type: 'string' },
      },
      required: ['image_url', 'image_prompt'],
    },
  },
];

// 工具到后端 API 路径映射
const ENDPOINT_MAP = {
  gbu_generate_comic_story: '/pulsar/mcp/inner/comic/generate_script',
  gbu_generate_comic_chapters: '/pulsar/mcp/inner/comic/generate_storyboards',
  gbu_generate_comic_image_prompts: '/pulsar/mcp/inner/comic/prompt_format',
  gbu_edit_comic_story: '/pulsar/mcp/inner/comic/edit_script',
  gbu_edit_comic_chapters: '/pulsar/mcp/inner/comic/edit_storyboards',
  gbu_ugc_tti: '/pulsar/mcp/inner/comic/generate_role',
  gbu_anime_pose_align: '/pulsar/mcp/inner/comic/pose_straighten',
  gbu_anime_comic_image: '/pulsar/mcp/inner/comic/generate_comic',
  gbu_flux_edit_image: '/pulsar/mcp/inner/comic/edit',
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
      payload = { edit_prompt, input_story: typeof input_story === 'string' ? input_story : JSON.stringify(input_story) };
    }
    if (name === 'gbu_edit_comic_chapters') {
      const { edit_prompt, input_chapters } = args;
      if (!edit_prompt || !input_chapters) throw new Error('edit_prompt 和 input_chapters 必填');
      payload = { edit_prompt, input_chapters: typeof input_chapters === 'string' ? input_chapters : JSON.stringify(input_chapters) };
    }
    if (name === 'gbu_flux_edit_image') {
      const { image_url, image_prompt } = args;
      if (!image_url || !image_prompt) throw new Error('image_url 和 image_prompt 必填');
      payload = { image_url, edit_prompt: image_prompt };
    }
    // Tools that stream responses but we want aggregated output
    if (['gbu_generate_comic_story', 'gbu_generate_comic_image_prompts', 'gbu_generate_comic_chapters'].includes(name)) {
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
    if (['gbu_anime_comic_image', 'gbu_anime_pose_align', 'gbu_ugc_tti'].includes(name)) {
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