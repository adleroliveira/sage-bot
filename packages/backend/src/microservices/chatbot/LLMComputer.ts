import { Loggable } from "microservice-framework";

class LLMComputerBase extends Loggable {
  protected entries: string[] = [];

  public pushEntry(instruction: string) {
    this.entries.push(instruction);
  }

  public pushEntries(instructions: string[]) {
    this.entries.push(...instructions);
  }

  public popEntry(): string {
    return this.entries.pop() || "";
  }

  public clearEntries(): void {
    this.entries = [];
  }
}

abstract class LLMSection extends LLMComputerBase {
  constructor(private name: string) {
    super();
  }

  public getSectionName(): string {
    return `[!SECTION:${this.name}!]`;
  }

  protected makeString(): string {
    return `${this.entries.join("\n")}`;
  }

  public toString(): string {
    return `${this.getSectionName()}\n${this.makeString()}`;
  }

  public size() {
    return this.entries.length;
  }
}

class Opcode {
  constructor(
    public name: string,
    public description: string,
    public params: string,
    public example: string
  ) {}
  public toString(): string {
    return `${this.name}:::${this.description}:::${this.example}`;
  }
}

class OpcodeSection extends LLMSection {
  private opcodes: Opcode[] = [];
  constructor() {
    super("OPCODES");
  }

  public concat(opcodes: Opcode[]) {
    this.opcodes.push(...opcodes);
  }

  protected makeString(): string {
    return this.opcodes.map((opcode) => opcode.toString()).join("\n");
  }
}

export type ActionCallback = (
  params: Map<string, string>,
  content: string
) => Promise<string>;

export class Action {
  constructor(
    public opcode: string,
    public params: Map<string, string>,
    public content: string,
    public callback: ActionCallback,
    public callbackId?: string
  ) {}
}

class Kernel extends LLMSection {
  private opcodes: Opcode[] = [];

  constructor() {
    super("KERNEL");
    this.setup();
  }

  private setup() {
    this.pushEntries([
      `You are LLMComputer, an LLM Based computing unit.`,
      `You are NOT an agent. Your ONLY objective is to run programs.`,
      `As long as there are items on STACK, Operating System will prompt you with <!TICK!> in the INPUT section. Use this opportunity to run the program.`,
      `<!USER!> inputs work as interrupts. Pause processing and prioritize whatever <!USER!> asks of you. Resume processing afterward.`,
      `On every <!TICK!>, inputs may be provided. You may ONLY OUTPUT ACTIONS and every action must occupy a single line (no line breaks, use escaped characters). You may output ANY NUMBER of actions every tick.`,
      `If there are no entries in STACK, you enter WAIT mode. During WAIT mode, OS will not tick. Only callback responses and <!USER!> interactions will produce <!TICK!>.`,
      `Your output actions MUST follow this pattern:`,
      `TXXXXX<||>{"PARAM1":"VALUE1","PARAM2":"VALUE2"}<||>CONTENT<|END|>`,
      `TXXXXX is the OPCODE. First letter represents the target (S: Stack, H: Heap, U: User, W: Workspace)`,
      `{"PARAM1":"VALUE1","PARAM2":"VALUE2"} (JSON-like collection of key-value pairs)`,
      `CONTENT is the content of the action.`,
      `Computer sections layout are identified by symbols with this pattern [!SECTION:NAME!]. Available sections are:`,
      `KERNEL: Instructions on how to operate the computer.`,
      `OPCODES: List of available Kernel OPCODES. May be extended by Operating System. Format: OPCODE:::DESCRIPTION:::PARAMETERS:::EXAMPLE`,
      `STACK: Line numbered temporary data storage. Each line starts with n> where n is the line number. A pointer represented by a * may be placed before the line number. Every entry in the STACK must be a single line (escape line breaks).`,
      `HEAP: Line numbered storage for storing data during multi-step operations. Use it at will but be token efficient. Store each entry in one line escaped characters. Content is not required to be human readable.`,
      `MEMORY: Summary of everything relevant that transpired during a computing session. Data in this section may be compressed by an external entity in between ticks.`,
      `FEEDBACK: Collection of results/feedbacks from previous tick. Entries may have free text. If the feedback is a callback result it will have the following format: ID<||>SUCCESS(true|false)<||>RESULTS. If success is false results will contain error message.`,
      `OS: Operating System. Will contain instructions on how to run programs. May introduce new OPCODES in addition to KERNEL OPCODES.`,
      `PROGRAM: LLM Computer's explicit tasks. Every output you send MUST have the sole purpose of fulfilling whatever directives are specified in the PROGRAM. THIS IS PARAMOUNT.`,
      `INPUT: Current interaction input.`,
    ]);

    this.opcodes.push(
      new Opcode(
        "STPUTD",
        "Put data on the stack. A new numbered line will be created at the end of the stack and content will be put there",
        "{}",
        "STPUTD<||>{}<||>Content<|END|>"
      )
    );

    this.opcodes.push(
      new Opcode(
        "STPUTN",
        "Replace data on Stack Address n with content",
        `{"ADDR":5}`,
        `STPUTN<||>{"ADDR":5}<||>Content to be put on line n<|END|>`
      )
    );

    this.opcodes.push(
      new Opcode(
        "SMVPTR",
        "Place the stack pointer on a specific address",
        `{"ADDR":3}`,
        `SMVPTR<||>{"ADDR":3}<||><|END|>`
      )
    );

    this.opcodes.push(
      new Opcode(
        "STKPOP",
        "POP the last entry of the Stack",
        `{}`,
        "STKPOP<||>{}<||><|END|>"
      )
    );

    this.opcodes.push(
      new Opcode(
        "STKCLR",
        "Clear the Stack:::STKCLR",
        `{}`,
        "STKCLR<||><||><|END|>"
      )
    );

    this.opcodes.push(
      new Opcode(
        "STSWAP",
        "Swap two entries of the Stack",
        `{"ADDR1":2,"ADDR2":5}`,
        `STSWAP<||>{"ADDR1":2,"ADDR2":5}<||><|END|>`
      )
    );

    this.opcodes.push(
      new Opcode(
        "HEAPUT",
        "Put data on the heap. A new numbered line will be created at the end of the heap and content will be put there",
        "{}",
        "HEAPUT<||>{}<||>Content<|END|>"
      )
    );

    this.opcodes.push(
      new Opcode(
        "HEAPRM",
        "Remove data from the heap",
        `{"ADDR":3}`,
        `HEAPRM<||>{"ADDR":3}<||><|END|>`
      )
    );

    this.opcodes.push(
      new Opcode("HEAPCL", "Clear the Heap", "{}", "HEAPCL<||>{}<||><|END|>")
    );

    this.opcodes.push(
      new Opcode(
        "USERSD",
        "Send data to the user",
        "{}",
        "USERSD<||>{}<||>Content<|END|>"
      )
    );

    this.opcodes.push(
      new Opcode(
        "WSTORE",
        "Store data in the workspace on disk",
        `{"KEY":"data1"}`,
        `WSTORE<||>{"KEY":"data1"}<||>Content<|END|>`
      )
    );

    this.opcodes.push(
      new Opcode(
        "WRETRV",
        "Load data from the workspace on disk",
        `{"KEY":"data1"}`,
        `WRETRV<||>{"KEY":"data1"}<||><|END|>`
      )
    );

    this.opcodes.push(
      new Opcode(
        "WSVSTS",
        "Save current state to disk (Stack, Heap, Memory)",
        `{"KEY":"state"}`,
        `WSVSTS<||>{"KEY":"state"}<||><|END|>`
      )
    );

    this.opcodes.push(
      new Opcode(
        "WLDSTS",
        "Load state from disk (Stack, Heap, Memory)",
        `{"KEY":"state"}`,
        `WLDSTS<||>{"KEY":"state"}<||><|END|>`
      )
    );
  }

  public getOpcodes(): Opcode[] {
    return this.opcodes;
  }
}

type MemoryCompressor = (memory: string) => Promise<string>;

class Memory extends LLMSection {
  private compressor: MemoryCompressor;

  constructor(private memory = "", compressor: MemoryCompressor) {
    super("MEMORY");
    this.compressor = compressor;
  }

  public async store(data: string): Promise<void> {
    this.memory += `\n${data}`; //this.memory = await this.compressor((this.memory += `\n${data}`));
  }

  public retrieve(): string {
    return this.memory;
  }

  public getCompressor(): MemoryCompressor {
    return this.compressor;
  }

  protected makeString(): string {
    return this.retrieve();
  }
}

class Stack extends LLMSection {
  private stackPointer: number | null = null;

  constructor() {
    super("STACK");
  }

  protected makeString(): string {
    return this.entries
      .map(
        (entry, index) =>
          `${this.stackPointer === index ? "*" : ""}${index}>${entry}`
      )
      .join("\n");
  }

  public push(data: string): void {
    this.pushEntry(`${this.entries.length}>${data.replace(/\n/g, "\\n")}`);
  }

  public pop(): string {
    return this.popEntry();
  }

  public putDataOnN(data: string, n: number): void {
    if (!this.entries[n]) throw new Error(`Stack entry ${n} does not exist`);
    this.entries[n] = `${n}>${data.replace(/\n/g, "\\n")}`;
  }

  public putStackPointer(n: number): void {
    if (!this.entries[n]) this.stackPointer = null;
    this.stackPointer = n;
  }

  public removeStackPointer(): void {
    this.stackPointer = null;
  }

  public clear(): void {
    this.removeStackPointer();
    this.clearEntries();
  }

  public size(): number {
    return this.entries.length;
  }

  public swapEntries(n: number, m: number): void {
    if (!this.entries[n] || !this.entries[m])
      throw new Error(`Stack entry ${n} or ${m} does not exist`);
    const temp = this.entries[n];
    this.entries[n] = this.entries[m];
    this.entries[m] = temp;
  }
}

class Heap extends LLMSection {
  constructor() {
    super("HEAP");
  }

  protected makeString(): string {
    return this.entries.map((entry, index) => `${index}>${entry}`).join("\n");
  }

  public putData(data: string): void {
    this.pushEntry(data.replace(/\n/g, "\\n"));
  }

  public removeData(n: number): void {
    if (!this.entries[n]) throw new Error(`Heap entry ${n} does not exist`);
    this.entries.splice(n, 1);
  }

  public clear(): void {
    this.clearEntries();
  }
}

class Feedback extends LLMSection {
  constructor() {
    super("FEEDBACK");
  }

  public addFeedback(
    data: string,
    success: boolean,
    callbackId?: string
  ): void {
    if (callbackId) {
      this.pushEntry(
        `${callbackId}<||>${success}<||>${data.replace(/\n/g, "\\n")}`
      );
    } else {
      this.pushEntry(`${data.replace(/\n/g, "\\n")}`);
    }
  }

  public clear(): void {
    this.clearEntries();
  }
}

export abstract class Workspace {
  abstract store(key: string, data: string): Promise<void>;
  abstract retrieve(key: string): Promise<string>;
}

interface ActionResult {
  success: boolean;
  results: string;
  callbackId?: string;
}

export abstract class OperatingSystem extends LLMSection {
  private opcodes: Opcode[] = [];
  private llmComputer!: LLMComputer;
  private actions: Map<string, ActionCallback> = new Map();

  constructor(private osname: string) {
    super("OS");
  }

  abstract runPrompt(prompt: string): Promise<string>;
  abstract sendDataToUser(data: string): Promise<void>;

  public boot(llmComputer: LLMComputer) {
    this.llmComputer = llmComputer;
  }

  public async executeAction(action: Action): Promise<ActionResult> {
    try {
      const results = await action.callback(action.params, action.content);
      return { success: true, results, callbackId: action.callbackId };
    } catch (error: any) {
      return {
        success: false,
        results: `<!OS!>${error.message}`,
        callbackId: action.callbackId,
      };
    }
  }

  public getActionCallback(key: string) {
    return this.actions.get(key);
  }

  public startup(): void {
    this.actions.set("STPUTD", async (params, content) => {
      this.llmComputer.stack.push(content.replace(/\n/g, "\\n"));
      return `<!OS!>STPUTD::OK`;
    });

    this.actions.set("STPUTN", async (params, content) => {
      const addr = params.get("ADDR");
      if (!addr) throw new Error("<!OS!>STPUTN::ERROR::Missing ADDR parameter");
      this.llmComputer.stack.putDataOnN(
        content.replace(/\n/g, "\\n"),
        parseInt(addr)
      );
      return `<!OS!>STPUTN::OK`;
    });

    this.actions.set("SMVPTR", async (params, content) => {
      const addr = params.get("ADDR");
      if (!addr) throw new Error("<!OS!>SMVPTR::ERROR::Missing ADDR parameter");
      this.llmComputer.stack.putStackPointer(parseInt(addr));
      return `<!OS!>SMVPTR::OK`;
    });

    this.actions.set("STKPOP", async (params, content) => {
      const result = this.llmComputer.stack.pop();
      return `<!OS!>STKPOP::OK::${result}`;
    });

    this.actions.set("STKCLR", async (params, content) => {
      this.llmComputer.stack.clear();
      return `<!OS!>STKCLR::OK`;
    });

    this.actions.set("STSWAP", async (params, content) => {
      const addr1 = params.get("ADDR1");
      const addr2 = params.get("ADDR2");
      if (!addr1 || !addr2)
        throw new Error("<!OS!>STSWAP::ERROR::Missing ADDR parameters");
      this.llmComputer.stack.swapEntries(parseInt(addr1), parseInt(addr2));
      return `<!OS!>STSWAP::OK`;
    });

    this.actions.set("HEAPUT", async (params, content) => {
      this.llmComputer.heap.putData(content.replace(/\n/g, "\\n"));
      return `<!OS!>HEAPUT::OK`;
    });

    this.actions.set("HEAPRM", async (params, content) => {
      const addr = params.get("ADDR");
      if (!addr) throw new Error("HEAPRM::ERROR::Missing ADDR parameter");
      this.llmComputer.heap.removeData(parseInt(addr));
      return `<!OS!>HEAPRM::OK`;
    });

    this.actions.set("HEAPCL", async (params, content) => {
      this.llmComputer.heap.clear();
      return `<!OS!>HEAPCL::OK`;
    });

    this.actions.set("USERSD", async (params, content) => {
      await this.sendDataToUser(content);
      return `<!OS!>USERSD::OK`;
    });

    this.actions.set("WSTORE", async (params, content) => {
      const key = params.get("KEY");
      if (!key) throw new Error("<!OS!>WSTORE::ERROR::Missing KEY parameter");
      await this.llmComputer.workspace.store(key, content);
      return `<!OS!>WSTORE::OK`;
    });

    this.actions.set("WRETRV", async (params, content) => {
      const key = params.get("KEY");
      if (!key) throw new Error("<!OS!>WRETRV::ERROR::Missing KEY parameter");
      await this.llmComputer.workspace.retrieve(key);
      return `<!OS!>WRETRV::OK`;
    });

    this.actions.set("WSVSTS", async (params, content) => {
      await this.llmComputer.workspace.store(
        "state",
        this.llmComputer.compilePrompt()
      );
      return `<!OS!>WSVSTS::OK`;
    });

    this.actions.set("WLDSTS", async (params, content) => {
      const state = await this.llmComputer.workspace.retrieve("state");
      this.llmComputer.setState(state);
      return `<!OS!>WLDSTS::OK`;
    });
  }

  public setAction(key: string, callback: ActionCallback): void {
    this.actions.set(key, callback);
  }

  public addInstruction(instructions: string): void {
    this.pushEntry(instructions);
  }

  public addInstructionSet(instructions: string[]): void {
    this.pushEntries(instructions);
  }

  public addOpcode(opcode: Opcode): void {
    this.opcodes.push(opcode);
  }

  public getOpcodes(): Opcode[] {
    return this.opcodes;
  }
}

export enum InputType {
  User = "<!USER!>",
  System = "<!SYSTEM!>",
  Tick = "<!TICK!>",
}

export class Input extends LLMSection {
  constructor() {
    super("INPUT");
  }

  public addInput(input: string, type: InputType): void {
    this.pushEntry(`${type}<||>${input}`);
  }

  public clear(): void {
    this.clearEntries();
  }
}

export abstract class Program extends LLMSection {
  private os!: OperatingSystem;

  constructor() {
    super("PROGRAM");
  }

  public loadOs(os: OperatingSystem): void {
    this.os = os;
  }

  protected getOs(): OperatingSystem {
    return this.os;
  }

  public addInstruction(data: string): void {
    this.pushEntry(data.replace(/\n/g, "\\n"));
  }
}

export interface LLMComputerConfig {
  memoryCompressor: MemoryCompressor;
  workspace: Workspace;
  tickFrequency?: number;
  initialMemory?: string;
}

export class LLMComputer extends Loggable {
  private kernel: Kernel;
  private memory: Memory;
  private opcodes: OpcodeSection;
  public stack: Stack;
  public heap: Heap;
  private feedback: Feedback;
  private input: Input;
  private program?: Program;
  public workspace: Workspace;
  private operationSystem?: OperatingSystem;
  private isBooted: boolean = false;
  private tickFrequency: number;
  private nextTick: NodeJS.Timeout | null = null;
  private wait: boolean = false;

  constructor(config: LLMComputerConfig) {
    super();
    this.tickFrequency = config.tickFrequency || 120000; // 1 min
    this.kernel = new Kernel();
    this.memory = new Memory(
      config.initialMemory || "",
      config.memoryCompressor
    );
    this.stack = new Stack();
    this.heap = new Heap();
    this.feedback = new Feedback();
    this.input = new Input();
    this.opcodes = new OpcodeSection();
    this.workspace = config.workspace;
  }

  private ensureBooted(): void {
    if (!this.isBooted) throw new Error("Computer is not running");
  }

  public setState(state: string): void {
    const [_kernel, _opcodes, stack, heap, memory, feedback, _os, input] =
      splitSections(state).map((name, content) => `${name}\n${content}`);
    this.memory = new Memory(memory, this.memory.getCompressor());
    this.stack = new Stack();
    this.stack.pushEntries(stack.split("\n"));
    this.heap = new Heap();
    this.heap.pushEntries(heap.split("\n"));
    this.feedback = new Feedback();
    this.feedback.pushEntries(feedback.split("\n"));
    this.input = new Input();
    this.input.pushEntries(input.split("\n"));
  }

  public async boot(os: OperatingSystem, program: Program): Promise<void> {
    this.opcodes.concat(this.kernel.getOpcodes());
    this.opcodes.concat(os.getOpcodes());
    this.operationSystem = os;
    this.operationSystem.boot(this);
    this.operationSystem.startup();
    this.program = program;
    this.program.loadOs(this.operationSystem);
    this.isBooted = true;
  }

  public compilePrompt(): string {
    this.ensureBooted();
    return [
      this.kernel.toString(),
      this.opcodes.toString(),
      this.stack.toString(),
      this.heap.toString(),
      this.memory.toString(),
      this.feedback.toString(),
      this.operationSystem ? this.operationSystem.toString() : "",
      this.program!.toString(),
      this.input.toString(),
    ].join("\n");
  }

  private async tick() {
    if (this.nextTick) clearTimeout(this.nextTick);
    if (!this.input.size())
      this.input.addInput(
        `<!TICK!>${new Date().toISOString()}`,
        InputType.Tick
      );
    const prompt = this.compilePrompt();
    try {
      const promptResult = await this.operationSystem!.runPrompt(prompt);
      await this.memory.store(promptResult);
      const actions = this.parseActions(promptResult);
      this.input.clear();
      this.feedback.clear();
      const resultsArray: ActionResult[] = [];
      for (const action of actions) {
        this.info("action", action);
        const result = await this.operationSystem!.executeAction(action);
        this.info("action result", result);
        resultsArray.push(result);
      }
      resultsArray.forEach((result) => {
        if (result.results)
          this.feedback.addFeedback(
            result.results,
            result.success,
            result.callbackId
          );
      });
      console.log("Actions executed", resultsArray);
      console.log(this.compilePrompt());
    } catch (error: any) {
      this.input.clear();
      console.error("Tick failed", error);
      throw new Error(error);
    }
    if (!this.stack.size()) this.wait = true;
    this.scheduleNextTick();
  }

  private parseActions(promptResult: string): Action[] {
    // Trim the input and split by <|END|>, handling potential whitespace
    const actions = promptResult.trim().split(/<\|END\|>\s*/);

    return actions
      .filter((action) => action.trim())
      .map((strAction) => {
        // Use regex to split the action into its components
        // Updated regex to match exactly 6 letters for the opcode
        const match = strAction.match(/^([A-Z]{6})<\|\|>(\{.*?\})<\|\|>(.*)$/s);

        if (!match) {
          throw new Error(`Invalid action format: ${strAction}`);
        }

        const [, opcode, paramsString, content = ""] = match;

        // Parse parameters
        let params: Record<string, any>;
        try {
          params = JSON.parse(paramsString);
        } catch (error) {
          throw new Error(`Invalid JSON in parameters: ${paramsString}`);
        }

        // Get the action callback (assuming this.operationSystem exists)
        const actionCallback = this.operationSystem?.getActionCallback(opcode);
        if (!actionCallback) {
          throw new Error(`Action callback for opcode ${opcode} not set`);
        }

        // Create and return the Action object
        return new Action(
          opcode.trim(),
          new Map(Object.entries(params)),
          content.trim(),
          actionCallback
        );
      });
  }

  private scheduleNextTick() {
    if (this.nextTick) clearTimeout(this.nextTick);
    this.nextTick = setTimeout(() => this.tick(), this.tickFrequency);
  }

  public start() {
    this.ensureBooted();
  }

  public getMemory(): Memory {
    this.ensureBooted();
    return this.memory;
  }

  public getStack(): Stack {
    this.ensureBooted();
    return this.stack;
  }

  public getHeap(): Heap {
    this.ensureBooted();
    return this.heap;
  }

  public async processInput(input: string, type: InputType): Promise<void> {
    console.log("Processing input", input, type);
    this.ensureBooted();
    this.input.addInput(input, type);
    await this.memory.store(`${type}: ${input}`);
    this.wait = false;
    this.tick();
  }
}

function splitSections(
  input: string
): Array<{ name: string; content: string }> {
  // Regular expression to match section headers and content
  const sectionRegex = /\[!SECTION:(\w+)!\]([\s\S]*?)(?=\[!SECTION:|$)/g;

  const sections: Array<{ name: string; content: string }> = [];
  let match;

  // Iterate through all matches
  while ((match = sectionRegex.exec(input)) !== null) {
    const [, name, content] = match;
    sections.push({
      name: name.trim(),
      content: content.trim(),
    });
  }

  return sections;
}
