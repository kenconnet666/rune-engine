/** 参与一局的一方：玩家、AI、回放都只用这个编号向模拟发命令 */
export type PlayerId = number;

/** 一条命令，连同它生效的那一步和发出它的一方 */
export interface Stamped<Command> {
  readonly tick: number;
  readonly player: PlayerId;
  readonly command: Command;
}

/**
 * 一个确定性的模拟：同样的配置、同样的命令序列，得到逐位相同的状态。
 * 状态只在 step（和 apply）里改变；外面的世界（界面、网络、AI）只能发命令、看 observe 的结果。
 */
export interface Simulation<Config, State, Command, View> {
  /** 按配置建出第 0 步的状态 */
  create(config: Config): State;
  /** 推进一步：commands 是这一步生效的命令（按提交顺序），直接改 state */
  step(state: State, commands: readonly Stamped<Command>[]): void;
  /**
   * 让一条命令立刻生效，不推进时间。写了它的模拟要保证：step(state, 命令们) 和“先逐条 apply、再 step(state, [])”
   * 结果逐位相同。主机靠它在收到命令时马上改状态——时间停着的时候下的命令也立刻看得到结果；
   * 记录里记的还是“这条命令在第几步生效”，重放时照旧走 step。
   */
  apply?(state: State, command: Stamped<Command>): void;
  /** 状态的哈希：回放、联机时用它核对两边算的是不是同一局 */
  hash(state: State): number;
  /** 某一方能看到的部分：双方看到的可以不一样（比如一方只看得到上报的数字） */
  observe(state: State, player: PlayerId): View;
}
