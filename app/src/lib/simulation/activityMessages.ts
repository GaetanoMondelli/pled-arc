/**
 * Standardized activity message formatting for simulation logs
 * Ensures consistent "from/to" messaging and proper token lineage tracking
 */

export interface TokenInfo {
  id: string;
  value: any;
}

export interface NodeInfo {
  id: string;
  name: string;
}

export class ActivityMessages {
  /**
   * Token emission: Source → Destination
   */
  static tokenEmitted(token: TokenInfo, source: NodeInfo, destination: NodeInfo): string {
    return `Token ${token.id} (${token.value}) → ${destination.name}`;
  }

  /**
   * Token received: Destination ← Source
   */
  static tokenReceived(token: TokenInfo, source: NodeInfo, destination: NodeInfo, bufferSize?: number): string {
    const buffer = bufferSize !== undefined ? ` [buffer: ${bufferSize}]` : '';
    return `Token ${token.id} (${token.value}) ← ${source.name}${buffer}`;
  }

  /**
   * Token consumed: Final processing
   */
  static tokenConsumed(token: TokenInfo, source: NodeInfo, processor: NodeInfo): string {
    return `Token ${token.id} (${token.value}) consumed ← ${source.name}`;
  }

  /**
   * Token dropped: Capacity exceeded
   */
  static tokenDropped(token: TokenInfo, source: NodeInfo, destination: NodeInfo, reason: string): string {
    return `Token ${token.id} (${token.value}) DROPPED ← ${source.name} (${reason})`;
  }

  /**
   * Aggregation: Multiple tokens → Single result
   */
  static aggregationResult(inputTokens: TokenInfo[], outputToken: TokenInfo, method: string, processor: NodeInfo): string {
    const inputValues = inputTokens.map(t => t.value).join(', ');
    return `${method}([${inputValues}]) → Token ${outputToken.id} (${outputToken.value})`;
  }

  /**
   * Transformation: Token processed through formula
   */
  static transformationResult(inputToken: TokenInfo, outputToken: TokenInfo, formula: string, processor: NodeInfo): string {
    return `${formula}(${inputToken.value}) → Token ${outputToken.id} (${outputToken.value})`;
  }

  /**
   * Buffer state: Collecting tokens
   */
  static bufferCollecting(bufferSize: number, capacity?: number): string {
    const capacityInfo = capacity ? `/${capacity}` : '';
    return `Collecting tokens [${bufferSize}${capacityInfo}]`;
  }

  /**
   * Processing state: Node is working
   */
  static processing(nodeInfo: NodeInfo, detail?: string): string {
    return detail ? `Processing: ${detail}` : 'Processing...';
  }

  /**
   * FSM transition: State change
   */
  static fsmTransition(fromState: string, toState: string, trigger: string): string {
    return `${fromState} → ${toState} (${trigger})`;
  }

  /**
   * Error state: Something went wrong
   */
  static error(message: string, context?: string): string {
    return context ? `ERROR: ${message} (${context})` : `ERROR: ${message}`;
  }

  /**
   * Idle state: Waiting for input
   */
  static idle(reason?: string): string {
    return reason ? `Idle: ${reason}` : 'Idle';
  }
}

/**
 * Enhanced color scheme for activity types
 */
export class ActivityColors {
  // Token lifecycle
  static tokenEmitted = "bg-green-100 text-green-800 border-green-200";
  static tokenReceived = "bg-blue-100 text-blue-800 border-blue-200";
  static tokenConsumed = "bg-purple-100 text-purple-800 border-purple-200";
  static tokenDropped = "bg-red-100 text-red-800 border-red-200";

  // Processing states
  static processing = "bg-orange-100 text-orange-800 border-orange-200";
  static accumulating = "bg-cyan-100 text-cyan-800 border-cyan-200";
  static emitting = "bg-emerald-100 text-emerald-800 border-emerald-200";
  static firing = "bg-violet-100 text-violet-800 border-violet-200";

  // Node states
  static idle = "bg-gray-100 text-gray-600 border-gray-200";
  static error = "bg-red-100 text-red-800 border-red-200";
  static consuming = "bg-pink-100 text-pink-800 border-pink-200";

  // FSM specific
  static fsmTransition = "bg-indigo-100 text-indigo-800 border-indigo-200";
  static fsmLog = "bg-slate-100 text-slate-700 border-slate-200";

  /**
   * Get color class for action type
   */
  static getActionColor(action: string): string {
    // Map action strings to color schemes
    if (action.includes("emitted") || action.includes("emit")) return this.tokenEmitted;
    if (action.includes("received") || action.includes("receive")) return this.tokenReceived;
    if (action.includes("consumed") || action.includes("consume")) return this.tokenConsumed;
    if (action.includes("dropped") || action.includes("drop")) return this.tokenDropped;
    if (action.includes("processing") || action.includes("process")) return this.processing;
    if (action.includes("accumulating") || action.includes("accumulate")) return this.accumulating;
    if (action.includes("emitting")) return this.emitting;
    if (action.includes("firing") || action.includes("fire")) return this.firing;
    if (action.includes("idle")) return this.idle;
    if (action.includes("error")) return this.error;
    if (action.includes("consuming")) return this.consuming;
    if (action.includes("fsm_transition")) return this.fsmTransition;
    if (action.includes("fsm_log")) return this.fsmLog;

    // Default
    return "bg-slate-100 text-slate-700 border-slate-200";
  }
}