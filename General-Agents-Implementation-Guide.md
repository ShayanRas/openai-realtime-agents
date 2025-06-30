# OpenAI Agents SDK: General Agents Implementation Guide

This comprehensive guide covers building general (non-voice) agents using the OpenAI Agents JavaScript SDK, based on the official documentation and best practices.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Environment Setup](#environment-setup)
3. [Creating Your First Agent](#creating-your-first-agent)
4. [Running Agents](#running-agents)
5. [Tools and Functions](#tools-and-functions)
6. [Multi-Agent Systems](#multi-agent-systems)
7. [Context Management](#context-management)
8. [Guardrails and Safety](#guardrails-and-safety)
9. [Streaming Responses](#streaming-responses)
10. [Human-in-the-Loop](#human-in-the-loop)
11. [Model Context Protocol (MCP)](#model-context-protocol-mcp)
12. [Advanced Features](#advanced-features)
13. [Production Considerations](#production-considerations)
14. [Troubleshooting](#troubleshooting)

## Core Concepts

### What is an Agent?

An Agent is a Large Language Model (LLM) configured with:
- **Instructions**: System prompt defining behavior
- **Model**: The LLM to use (default: `gpt-4o`)
- **Tools**: Functions and APIs the agent can use
- **Context**: Shared state and dependencies

### Basic Agent Structure

```javascript
import { Agent } from '@openai/agents';

const agent = new Agent({
  name: 'Assistant',
  instructions: 'You are a helpful assistant.',
  model: 'gpt-4o',
  tools: [/* tools array */],
  context: {/* shared context */}
});
```

## Environment Setup

### Installation

```bash
npm install @openai/agents
```

### Authentication

Set your OpenAI API key:

```javascript
import { setDefaultOpenAIKey } from '@openai/agents';

// Option 1: Environment variable
process.env.OPENAI_API_KEY = 'your-api-key';

// Option 2: Programmatic
setDefaultOpenAIKey('your-api-key');
```

### Debug Logging

Enable detailed logging for development:

```bash
export DEBUG=openai-agents*
```

## Creating Your First Agent

### Simple Agent Example

```javascript
import { Agent, run } from '@openai/agents';

const weatherBot = new Agent({
  name: 'Weather Assistant',
  instructions: `You are a helpful weather assistant. 
    You provide current weather information for any city.`,
  model: 'gpt-4o'
});

// Run the agent
const result = await run(weatherBot, 'What\'s the weather in Paris?');
console.log(result.output);
```

### Agent with Custom Instructions

```javascript
const customerServiceAgent = new Agent({
  name: 'Customer Service',
  instructions: `You are a professional customer service representative.
    - Always be polite and helpful
    - Escalate complex issues to human agents
    - Provide clear, actionable solutions
    - Ask clarifying questions when needed`,
  model: 'gpt-4o',
  maxTokens: 1000,
  temperature: 0.3
});
```

## Running Agents

### Basic Execution

```javascript
import { run, Runner } from '@openai/agents';

// Simple run
const result = await run(agent, 'Hello, how can you help me?');

// Using Runner class for more control
const runner = new Runner(agent);
const result = await runner.run('Hello, how can you help me?', {
  stream: false,
  maxTurns: 5,
  context: { userId: '123' }
});
```

### Conversation Management

```javascript
let conversationHistory = [];

async function chat(userMessage) {
  const result = await run(agent, [...conversationHistory, userMessage]);
  
  // Update conversation history
  conversationHistory = result.history;
  
  return result.output;
}

// Usage
const response1 = await chat('Hello');
const response2 = await chat('What did I just say?'); // Agent remembers context
```

### Error Handling

```javascript
try {
  const result = await run(agent, userInput);
  return result.output;
} catch (error) {
  if (error.name === 'MaxTurnsExceededError') {
    console.log('Agent exceeded maximum turns');
  } else if (error.name === 'GuardrailError') {
    console.log('Guardrail triggered:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Tools and Functions

### Creating Function Tools

```javascript
import { tool } from '@openai/agents';
import { z } from 'zod';

const getWeatherTool = tool({
  name: 'get_weather',
  description: 'Get current weather for a city',
  parameters: z.object({
    city: z.string().describe('The city name'),
    unit: z.enum(['celsius', 'fahrenheit']).default('celsius')
  }),
  async execute({ city, unit }) {
    // Simulate API call
    const temperature = Math.floor(Math.random() * 30) + 10;
    const symbol = unit === 'celsius' ? '°C' : '°F';
    
    return {
      city,
      temperature: `${temperature}${symbol}`,
      condition: 'Sunny',
      humidity: '45%'
    };
  }
});
```

### Using Tools in Agents

```javascript
const weatherAgent = new Agent({
  name: 'Weather Bot',
  instructions: 'You provide weather information using the get_weather tool.',
  tools: [getWeatherTool]
});

const result = await run(weatherAgent, 'What\'s the weather in Tokyo?');
```

### Advanced Tool Features

```javascript
const sensitiveActionTool = tool({
  name: 'delete_file',
  description: 'Delete a file from the system',
  parameters: z.object({
    filename: z.string()
  }),
  needsApproval: true, // Requires human approval
  async execute({ filename }) {
    // Delete file logic
    return `File ${filename} deleted successfully`;
  }
});

const databaseTool = tool({
  name: 'query_database',
  description: 'Query the database',
  parameters: z.object({
    query: z.string()
  }),
  strict: true, // Enforce strict parameter validation
  async execute({ query }, context) {
    // Access shared context
    const db = context.database;
    return await db.query(query);
  }
});
```

## Multi-Agent Systems

### Agent Handoffs

```javascript
import { Agent, handoff } from '@openai/agents';

const triageAgent = new Agent({
  name: 'Triage',
  instructions: 'Route customers to the appropriate specialist.',
  handoffs: [billingAgent, refundAgent]
});

const billingAgent = new Agent({
  name: 'Billing Specialist',
  instructions: 'Handle billing questions and payment issues.',
  tools: [processBillingTool]
});

const refundAgent = new Agent({
  name: 'Refund Specialist', 
  instructions: 'Process refund requests and handle disputes.',
  tools: [processRefundTool]
});
```

### Custom Handoff Configuration

```javascript
const customHandoff = handoff(billingAgent, {
  name: 'transfer_to_billing',
  description: 'Transfer to billing for payment issues',
  parameters: z.object({
    issue_type: z.string(),
    priority: z.enum(['low', 'medium', 'high'])
  })
});

const triageAgent = new Agent({
  name: 'Triage',
  instructions: 'Route customers based on their needs.',
  handoffs: [customHandoff]
});
```

### Sequential Agent Orchestration

```javascript
async function processCustomerRequest(request) {
  // Step 1: Triage
  const triageResult = await run(triageAgent, request);
  
  // Step 2: Specialist handling
  const specialist = determineSpecialist(triageResult);
  const specialistResult = await run(specialist, triageResult.output);
  
  // Step 3: Follow-up
  const followUpResult = await run(followUpAgent, [
    ...triageResult.history,
    ...specialistResult.history
  ]);
  
  return followUpResult.output;
}
```

## Context Management

### Local Context for State Management

```javascript
interface AppContext {
  userId: string;
  database: Database;
  cache: Cache;
  permissions: string[];
}

const contextAwareAgent = new Agent<AppContext>({
  name: 'Context Aware Agent',
  instructions: 'Use the provided context to personalize responses.',
  tools: [userDataTool]
});

const userDataTool = tool({
  name: 'get_user_data',
  description: 'Get user specific data',
  parameters: z.object({
    dataType: z.string()
  }),
  async execute({ dataType }, context) {
    // Access context
    const userData = await context.database.getUserData(context.userId);
    return userData[dataType];
  }
});
```

### Dynamic Instructions with Context

```javascript
const personalizedAgent = new Agent({
  name: 'Personal Assistant',
  instructions: (context) => `
    You are a personal assistant for ${context.userName}.
    User preferences: ${JSON.stringify(context.preferences)}
    Current time: ${new Date().toISOString()}
  `,
  tools: [calendarTool, emailTool]
});
```

## Guardrails and Safety

### Input Guardrails

```javascript
const contentFilter = async (input) => {
  // Check for inappropriate content
  const isInappropriate = await checkContent(input);
  
  if (isInappropriate) {
    return {
      tripwire: 'inappropriate_content',
      description: 'Content violates community guidelines'
    };
  }
  
  return { tripwire: null };
};

const safeAgent = new Agent({
  name: 'Safe Assistant',
  instructions: 'You are a helpful and safe assistant.',
  inputGuardrails: [contentFilter]
});
```

### Output Guardrails

```javascript
const outputFilter = async (output) => {
  // Check if output contains sensitive information
  if (containsSensitiveInfo(output)) {
    return {
      tripwire: 'sensitive_data',
      description: 'Output contains sensitive information'
    };
  }
  
  return { tripwire: null };
};

const secureAgent = new Agent({
  name: 'Secure Assistant',
  instructions: 'Provide helpful responses while protecting privacy.',
  outputGuardrails: [outputFilter]
});
```

## Streaming Responses

### Basic Streaming

```javascript
const streamingResult = await run(agent, 'Tell me a story', { stream: true });

// Method 1: Text streaming
const textStream = streamingResult.toTextStream();
for await (const chunk of textStream) {
  process.stdout.write(chunk);
}

// Method 2: Event streaming
for await (const event of streamingResult) {
  console.log('Event:', event.type, event.data);
}

// Always await completion
await streamingResult.completed;
```

### Advanced Streaming with UI Updates

```javascript
async function streamToUI(userInput) {
  const stream = await run(agent, userInput, { stream: true });
  
  // Update UI in real-time
  for await (const chunk of stream.toTextStream()) {
    updateChatUI(chunk);
  }
  
  // Get final result
  const result = await stream.completed;
  return result;
}
```

## Human-in-the-Loop

### Approval Workflows

```javascript
const approvalTool = tool({
  name: 'send_email',
  description: 'Send an email to a recipient',
  parameters: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string()
  }),
  needsApproval: async ({ to, subject }) => {
    // Require approval for external emails
    return to.includes('@external.com');
  },
  async execute({ to, subject, body }) {
    // Send email logic
    return `Email sent to ${to}`;
  }
});

// Handle approval workflow
const result = await run(agentWithApprovalTool, 'Send a summary to john@external.com');

if (result.interruptions.length > 0) {
  // Present approval request to user
  const approval = await presentApprovalUI(result.interruptions[0]);
  
  if (approval.approved) {
    // Continue execution
    const resumedResult = await run(agent, result.state.approve(approval.toolCallId));
    return resumedResult.output;
  } else {
    // Reject and stop
    return result.state.reject(approval.toolCallId, 'User rejected the action');
  }
}
```

## Model Context Protocol (MCP)

### Using MCP Servers

```javascript
import { MCPServerStdio } from '@openai/agents';

// Connect to local MCP server
const mcpServer = new MCPServerStdio({
  command: 'path/to/mcp-server',
  args: ['--config', 'config.json']
});

const mcpAgent = new Agent({
  name: 'MCP Agent',
  instructions: 'Use MCP tools to help users.',
  tools: [mcpServer] // Server tools are auto-discovered
});
```

### Hosted MCP Tools

```javascript
import { hostedMcpTool } from '@openai/agents';

const webSearchTool = hostedMcpTool({
  serverUrl: 'https://api.example.com/mcp',
  toolName: 'web_search'
});

const researchAgent = new Agent({
  name: 'Research Assistant',
  instructions: 'Help users research topics using web search.',
  tools: [webSearchTool]
});
```

## Advanced Features

### Structured Output

```javascript
import { z } from 'zod';

const analysisSchema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number().min(0).max(1),
  keywords: z.array(z.string()),
  summary: z.string()
});

const analysisAgent = new Agent({
  name: 'Text Analyzer',
  instructions: 'Analyze text and return structured results.',
  outputSchema: analysisSchema
});

const result = await run(analysisAgent, 'Analyze this review: "Great product!"');
// result.output is typed according to analysisSchema
```

### Agent Cloning

```javascript
const baseAgent = new Agent({
  name: 'Base Agent',
  instructions: 'You are a helpful assistant.',
  tools: [commonTool]
});

// Clone with modifications
const specializedAgent = baseAgent.clone({
  name: 'Specialized Agent',
  instructions: 'You are a specialized assistant for technical support.',
  tools: [commonTool, technicalTool]
});
```

### Model Configuration

```javascript
const optimizedAgent = new Agent({
  name: 'Optimized Agent',
  instructions: 'Provide concise, accurate responses.',
  model: 'gpt-4o',
  temperature: 0.1,
  topP: 0.9,
  maxTokens: 500,
  frequencyPenalty: 0.1,
  presencePenalty: 0.1
});
```

## Production Considerations

### Configuration Management

```javascript
import { setDefaultOpenAIKey, setTracingDisabled } from '@openai/agents';

// Environment-based configuration
const config = {
  apiKey: process.env.OPENAI_API_KEY,
  enableTracing: process.env.NODE_ENV === 'development',
  logLevel: process.env.LOG_LEVEL || 'info'
};

setDefaultOpenAIKey(config.apiKey);
if (!config.enableTracing) {
  setTracingDisabled(true);
}
```

### Error Handling and Monitoring

```javascript
class AgentService {
  constructor() {
    this.agents = new Map();
    this.metrics = new MetricsCollector();
  }
  
  async runAgent(agentName, input, options = {}) {
    const startTime = Date.now();
    
    try {
      const agent = this.agents.get(agentName);
      if (!agent) {
        throw new Error(`Agent ${agentName} not found`);
      }
      
      const result = await run(agent, input, {
        maxTurns: 10,
        timeout: 30000,
        ...options
      });
      
      this.metrics.recordSuccess(agentName, Date.now() - startTime);
      return result;
      
    } catch (error) {
      this.metrics.recordError(agentName, error.name);
      throw error;
    }
  }
}
```

### Rate Limiting and Concurrency

```javascript
import pLimit from 'p-limit';

class RateLimitedAgentRunner {
  constructor(concurrency = 5) {
    this.limit = pLimit(concurrency);
  }
  
  async runAgent(agent, input, options = {}) {
    return this.limit(async () => {
      return await run(agent, input, options);
    });
  }
  
  async runBatch(requests) {
    const promises = requests.map(req => 
      this.runAgent(req.agent, req.input, req.options)
    );
    
    return Promise.allSettled(promises);
  }
}
```

### Tracing and Observability

```javascript
import { withTrace } from '@openai/agents';

async function processUserRequest(request) {
  return withTrace(
    { name: 'user_request_processing', metadata: { userId: request.userId }},
    async () => {
      const result = await run(agent, request.message);
      
      // Custom metrics
      recordLatency('agent_response', result.duration);
      recordTokenUsage('agent_tokens', result.usage);
      
      return result.output;
    }
  );
}
```

## Troubleshooting

### Common Issues and Solutions

#### Environment Compatibility
```javascript
// Check environment support
const isSupported = typeof process !== 'undefined' && 
                   process.versions && 
                   process.versions.node;

if (!isSupported) {
  console.warn('Limited environment support detected');
}
```

#### Debug Logging
```bash
# Enable all debug logs
export DEBUG=openai-agents*

# Enable specific components
export DEBUG=openai-agents:core,openai-agents:openai

# Disable sensitive data logging
export OPENAI_AGENTS_DONT_LOG_MODEL_DATA=1
export OPENAI_AGENTS_DONT_LOG_TOOL_DATA=1
```

#### Tool Execution Issues
```javascript
const debugTool = tool({
  name: 'debug_tool',
  description: 'A tool for debugging',
  parameters: z.object({
    input: z.string()
  }),
  async execute({ input }, context) {
    console.log('Tool called with:', input);
    console.log('Context:', context);
    
    try {
      const result = await processInput(input);
      return result;
    } catch (error) {
      console.error('Tool execution error:', error);
      throw error;
    }
  }
});
```

### Performance Optimization

```javascript
// Optimize for production
const productionAgent = new Agent({
  name: 'Production Agent',
  instructions: 'Provide efficient responses.',
  model: 'gpt-4o-mini', // Faster, cheaper model
  maxTokens: 200,       // Limit response length
  temperature: 0,       // Deterministic responses
  tools: [optimizedTool]
});

// Batch similar requests
async function batchProcess(requests) {
  const batches = chunkArray(requests, 10);
  const results = [];
  
  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(req => run(agent, req))
    );
    results.push(...batchResults);
  }
  
  return results;
}
```

## Best Practices Summary

1. **Agent Design**
   - Keep instructions clear and specific
   - Use appropriate models for the task complexity
   - Implement proper error handling

2. **Tools**
   - Create focused, single-purpose tools
   - Use strict parameter validation
   - Implement approval workflows for sensitive operations

3. **Context Management**
   - Use local context for application state
   - Inject LLM context appropriately
   - Maintain conversation history effectively

4. **Security**
   - Implement input/output guardrails
   - Use approval workflows for risky operations
   - Validate all tool inputs

5. **Performance**
   - Choose appropriate models for each task
   - Implement rate limiting and concurrency controls
   - Monitor and optimize token usage

6. **Production**
   - Implement comprehensive error handling
   - Set up proper logging and monitoring
   - Use environment-specific configurations

This guide provides a comprehensive foundation for building sophisticated AI agents with the OpenAI Agents SDK. Start with simple agents and gradually incorporate advanced features as your use cases become more complex.