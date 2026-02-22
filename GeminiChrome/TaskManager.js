// TaskManager.js - Manages user tasks and website navigation guidance

export class TaskManager {
  constructor(onStatusUpdate) {
    this.currentTask = null;
    this.taskSteps = [];
    this.currentStepIndex = 0;
    this.onStatusUpdate = onStatusUpdate;
    this.taskContext = {};
  }

  /**
   * Parse user's request and build a task
   */
  analyzeUserRequest(transcript) {
    const lowerTranscript = transcript.toLowerCase();
    
    // Email-related tasks
    if (this.matchesKeywords(lowerTranscript, ['send', 'email', 'mail', 'compose'])) {
      return this.createEmailTask(transcript);
    }
    
    // Shopping-related tasks
    if (this.matchesKeywords(lowerTranscript, ['buy', 'shop', 'add to cart', 'order', 'purchase'])) {
      return this.createShoppingTask(transcript);
    }
    
    // Search tasks
    if (this.matchesKeywords(lowerTranscript, ['find', 'search', 'look for', 'google'])) {
      return this.createSearchTask(transcript);
    }
    
    // Banking tasks
    if (this.matchesKeywords(lowerTranscript, ['transfer', 'pay bill', 'check balance', 'account'])) {
      return this.createBankingTask(transcript);
    }
    
    // General navigation
    if (this.matchesKeywords(lowerTranscript, ['click', 'find', 'go to', 'open', 'navigate'])) {
      return this.createNavigationTask(transcript);
    }
    
    return null;
  }

  matchesKeywords(text, keywords) {
    return keywords.some(keyword => text.includes(keyword));
  }

  /**
   * Create an email composition task
   */
  createEmailTask(transcript) {
    return {
      type: 'email',
      description: 'Compose and send an email',
      steps: [
        {
          instruction: "I'll help you send an email. First, let me look for the compose button on this page.",
          actionType: 'click',
          selectors: ['[aria-label*="Compose"]', '.compose-button', '[data-tooltip*="Compose"]', 'a:contains("Compose")'],
          hint: "Look for a button that says 'Compose', 'New', or has a pencil icon"
        },
        {
          instruction: "Now, please tell me who you want to send this email to. I'll wait for you to say their email address or name.",
          actionType: 'wait_for_user_input',
          field: 'recipient',
          hint: "Say the recipient's email address or their name"
        },
        {
          instruction: "Please tell me the subject of your email.",
          actionType: 'fill_field',
          selectors: ['input[placeholder*="Subject"]', '[aria-label*="Subject"]'],
          field: 'subject',
          hint: "Say what you want the subject to be"
        },
        {
          instruction: "Now please tell me what you want to say in the email body. Take your time.",
          actionType: 'fill_field',
          selectors: ['[role="textbox"]', '.email-body', 'textarea'],
          field: 'body',
          hint: "Tell me the message you want to send"
        },
        {
          instruction: "I'll send this email for you now.",
          actionType: 'click',
          selectors: ['[aria-label*="Send"]', '.send-button', 'button:contains("Send")'],
          hint: "Look for a 'Send' button"
        }
      ]
    };
  }

  /**
   * Create a shopping task
   */
  createShoppingTask(transcript) {
    return {
      type: 'shopping',
      description: 'Help you find and purchase something online',
      steps: [
        {
          instruction: "What would you like to buy? Please tell me the product name.",
          actionType: 'wait_for_user_input',
          field: 'product_name',
          hint: "Say the name of the product you want to buy"
        },
        {
          instruction: "Let me search for that product on this website.",
          actionType: 'fill_field',
          selectors: ['input[type="search"]', 'input[placeholder*="Search"]', '.search-box'],
          field: 'search_query',
          hint: "I'll type in the search box"
        },
        {
          instruction: "I'll press Enter to search.",
          actionType: 'key_press',
          key: 'Enter'
        },
        {
          instruction: "Now let me find the product you want from the search results.",
          actionType: 'wait_for_screenshot',
          hint: "I'm looking at the search results"
        },
        {
          instruction: "Which of these products would you like? Point to one or describe it.",
          actionType: 'wait_for_user_input',
          field: 'product_selection',
          hint: "Tell me which product you want"
        },
        {
          instruction: "I'll add this to your cart.",
          actionType: 'click',
          selectors: ['button:contains("Add to Cart")', '[aria-label*="Add to Cart"]', '.add-to-cart-btn'],
          hint: "Looking for 'Add to Cart' button"
        },
        {
          instruction: "Now let me proceed to checkout.",
          actionType: 'click',
          selectors: ['button:contains("Checkout")', 'a:contains("Checkout")', '.checkout-btn'],
          hint: "Finding checkout button"
        }
      ]
    };
  }

  /**
   * Create a search task
   */
  createSearchTask(transcript) {
    return {
      type: 'search',
      description: 'Search for something online',
      steps: [
        {
          instruction: "What would you like me to search for? Please tell me.",
          actionType: 'wait_for_user_input',
          field: 'search_query',
          hint: "Tell me what to search for"
        },
        {
          instruction: "Let me click on the search box.",
          actionType: 'click',
          selectors: ['input[type="search"]', '[role="searchbox"]', '.search-input'],
          hint: "Finding the search box"
        },
        {
          instruction: "Now I'll type what you want to search for.",
          actionType: 'type_text',
          field: 'search_query'
        },
        {
          instruction: "I'll press Enter to search.",
          actionType: 'key_press',
          key: 'Enter'
        },
        {
          instruction: "Here are the search results. Would you like me to open any of these?",
          actionType: 'wait_for_user_input',
          field: 'result_selection',
          hint: "Tell me which result you want to open"
        }
      ]
    };
  }

  /**
   * Create a banking task
   */
  createBankingTask(transcript) {
    return {
      type: 'banking',
      description: 'Help with banking tasks',
      steps: [
        {
          instruction: "I can help you with banking tasks. What would you like to do? Check your balance, transfer money, or pay a bill?",
          actionType: 'wait_for_user_input',
          field: 'banking_action',
          hint: "Tell me what you want to do"
        },
        {
          instruction: "I'll navigate to the appropriate section of your bank's website.",
          actionType: 'wait_for_screenshot',
          hint: "Looking at your bank's interface"
        }
      ]
    };
  }

  /**
   * Create a general navigation task
   */
  createNavigationTask(transcript) {
    return {
      type: 'navigation',
      description: 'Navigate to a specific part of the website',
      steps: [
        {
          instruction: "What would you like to find on this website? Tell me.",
          actionType: 'wait_for_user_input',
          field: 'target',
          hint: "Tell me what you're looking for"
        },
        {
          instruction: "Let me look for that on the page.",
          actionType: 'wait_for_screenshot',
          hint: "Analyzing the page"
        }
      ]
    };
  }

  /**
   * Start a task
   */
  async startTask(task) {
    this.currentTask = task;
    this.currentStepIndex = 0;
    this.taskSteps = task.steps || [];
    this.taskContext = {};
    
    const message = `Great! I'll help you ${task.description}. Let me start by understanding what you need.`;
    this.onStatusUpdate(message);
    
    return this.executeNextStep();
  }

  /**
   * Execute the next step in the task
   */
  async executeNextStep() {
    if (!this.currentTask || this.currentStepIndex >= this.taskSteps.length) {
      return {
        complete: true,
        message: 'Task completed! Is there anything else I can help you with?'
      };
    }
    
    const step = this.taskSteps[this.currentStepIndex];
    
    switch (step.actionType) {
      case 'wait_for_user_input':
        return this.stepWaitForInput(step);
      case 'click':
        return this.stepClick(step);
      case 'fill_field':
        return this.stepFillField(step);
      case 'type_text':
        return this.stepTypeText(step);
      case 'key_press':
        return this.stepKeyPress(step);
      case 'wait_for_screenshot':
        return this.stepWaitForScreenshot(step);
      default:
        this.currentStepIndex++;
        return this.executeNextStep();
    }
  }

  stepWaitForInput(step) {
    return {
      waiting: true,
      instruction: step.instruction,
      hint: step.hint,
      field: step.field
    };
  }

  stepClick(step) {
    return {
      action: 'click',
      selectors: step.selectors,
      instruction: step.instruction,
      hint: step.hint
    };
  }

  stepFillField(step) {
    return {
      action: 'fill_field',
      selectors: step.selectors,
      instruction: step.instruction,
      hint: step.hint,
      field: step.field
    };
  }

  stepTypeText(step) {
    return {
      action: 'type_text',
      instruction: step.instruction,
      field: step.field
    };
  }

  stepKeyPress(step) {
    return {
      action: 'key_press',
      key: step.key
    };
  }

  stepWaitForScreenshot(step) {
    return {
      action: 'wait_for_screenshot',
      instruction: step.instruction,
      hint: step.hint
    };
  }

  /**
   * Process user input for the current step
   */
  processUserInput(userSaid) {
    if (!this.currentTask) {
      return { error: 'No active task' };
    }

    const step = this.taskSteps[this.currentStepIndex];
    if (step.field) {
      this.taskContext[step.field] = userSaid;
    }

    this.currentStepIndex++;
    return this.executeNextStep();
  }

  /**
   * Get friendly guidance message
   */
  getFriendlyMessage(message) {
    const messages = {
      waiting_input: "I'm listening. Please tell me what you'd like to do.",
      analyzing: "Let me analyze what I see on the screen.",
      looking_for: "I'm looking for the right button for you.",
      processing: "Just a moment, I'm processing that..."
    };
    
    return messages[message] || "I'm here to help. What would you like to do?";
  }

  /**
   * Cancel current task
   */
  cancelTask() {
    this.currentTask = null;
    this.taskSteps = [];
    this.currentStepIndex = 0;
    this.taskContext = {};
  }
}
