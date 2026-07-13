"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Task = {
  id: string;
  title: string;
  completed: boolean;
};

type SavedState = {
  date: string;
  tasks: Task[];
  bingoHistory?: string[];
};

type BoardSlot = {
  task: Task;
  repeated: boolean;
};

const STORAGE_KEY = "daily-bingo-state-v1";
const MIN_TASKS = 5;
const MAX_TASKS = 36;

function localDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatHistoryDate(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function bingoCelebrationMessage(lineCount: number, allTasksCompleted: boolean) {
  if (allTasksCompleted) return "太厉害了，今天所有任务都完成了！";
  if (lineCount <= 1) return "今天已经做完一整条线了！";

  const chineseNumbers = [
    "零", "一", "二", "三", "四", "五", "六", "七", "八", "九",
    "十", "十一", "十二", "十三", "十四",
  ];
  const countLabel = chineseNumbers[lineCount] ?? String(lineCount);
  return `今天已经做完整整${countLabel}条线了！`;
}

function boardSizeFor(taskCount: number) {
  if (taskCount <= 9) return 3;
  if (taskCount <= 16) return 4;
  if (taskCount <= 25) return 5;
  return 6;
}

function hashText(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffled<T>(items: T[], seed: number) {
  const copy = [...items];
  let state = seed || 1;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const target = state % (index + 1);
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function getLines(size: number) {
  const lines: number[][] = [];
  for (let row = 0; row < size; row += 1) {
    lines.push(Array.from({ length: size }, (_, column) => row * size + column));
  }
  for (let column = 0; column < size; column += 1) {
    lines.push(Array.from({ length: size }, (_, row) => row * size + column));
  }
  lines.push(Array.from({ length: size }, (_, index) => index * size + index));
  lines.push(
    Array.from({ length: size }, (_, index) => index * size + (size - index - 1)),
  );
  return lines;
}

function duplicateLineScore(slots: BoardSlot[], size: number) {
  return getLines(size).reduce((score, line) => {
    const ids = line.map((index) => slots[index].task.id);
    return score + (ids.length - new Set(ids).size);
  }, 0);
}

function buildBoard(tasks: Task[], size: number) {
  const cellCount = size * size;
  const repeatCount = cellCount - tasks.length;
  const repeatOrder = shuffled(tasks, hashText(tasks.map((task) => task.id).join("|")));
  const rawSlots: BoardSlot[] = [
    ...tasks.map((task) => ({ task, repeated: false })),
    ...repeatOrder.slice(0, repeatCount).map((task) => ({ task, repeated: true })),
  ];

  let best = rawSlots;
  let bestScore = Number.POSITIVE_INFINITY;
  const baseSeed = hashText(tasks.map((task) => task.id).join("/"));

  for (let attempt = 0; attempt < 180; attempt += 1) {
    const candidate = shuffled(rawSlots, baseSeed + attempt * 7919);
    const score = duplicateLineScore(candidate, size);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
      if (score === 0) break;
    }
  }

  return best;
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [showBingo, setShowBingo] = useState(false);
  const [bingoHistory, setBingoHistory] = useState<string[]>([]);
  const [activePanel, setActivePanel] = useState<"tasks" | null>(null);
  const previousBingoCount = useRef(0);

  /* eslint-disable react-hooks/set-state-in-effect -- Device-local data is restored after the browser mounts. */
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as SavedState;
        const isToday = parsed.date === localDateKey();
        const restored = Array.isArray(parsed.tasks)
          ? parsed.tasks.slice(0, MAX_TASKS).map((task) => ({
              id: task.id,
              title: task.title,
              completed: isToday ? Boolean(task.completed) : false,
            }))
          : [];
        setTasks(restored);
        setBingoHistory(
          Array.isArray(parsed.bingoHistory)
            ? parsed.bingoHistory.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
            : [],
        );
      }
    } catch {
      setMessage("旧数据读取失败，可以重新添加任务。");
    } finally {
      setReady(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!ready) return;
    const state: SavedState = { date: localDateKey(), tasks, bingoHistory };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [bingoHistory, ready, tasks]);

  const size = boardSizeFor(tasks.length);
  const canShowBoard = tasks.length >= MIN_TASKS;
  const board = useMemo(
    () => (canShowBoard ? buildBoard(tasks, size) : []),
    [canShowBoard, size, tasks],
  );
  const lines = useMemo(() => getLines(size), [size]);
  const completedCount = tasks.filter((task) => task.completed).length;
  const allTasksCompleted = canShowBoard && completedCount === tasks.length;
  const progress = canShowBoard
    ? Math.min(100, Math.round((completedCount / size) * 100))
    : 0;
  const winningLines = useMemo(
    () =>
      lines.filter((line) => {
        const lineSlots = line.map((index) => board[index]);
        if (lineSlots.some((slot) => !slot?.task.completed)) return false;
        return new Set(lineSlots.map((slot) => slot.task.id)).size === size;
      }),
    [board, lines, size],
  );
  const winningCells = useMemo(
    () => new Set(winningLines.flat()),
    [winningLines],
  );

  useEffect(() => {
    if (winningLines.length > previousBingoCount.current) {
      setShowBingo(true);
      const today = localDateKey();
      setBingoHistory((current) =>
        current.includes(today) ? current : [today, ...current].slice(0, 366),
      );
    }
    previousBingoCount.current = winningLines.length;
  }, [winningLines.length]);

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.trim().replace(/\s+/g, " ");
    if (!title) {
      setMessage("先写下一个任务吧。");
      return;
    }
    if (tasks.length >= MAX_TASKS) {
      setMessage("最多可以添加 36 个任务。");
      return;
    }
    if (tasks.some((task) => task.title.toLocaleLowerCase() === title.toLocaleLowerCase())) {
      setMessage("这个任务已经添加过了。");
      return;
    }
    setTasks((current) => [
      ...current,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, completed: false },
    ]);
    setDraft("");
    setMessage("");
  }

  function removeTask(id: string) {
    setTasks((current) => current.filter((task) => task.id !== id));
    setMessage("");
  }

  function toggleTask(id: string) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task,
      ),
    );
  }

  const tasksNeeded = Math.max(0, MIN_TASKS - tasks.length);

  if (!ready) {
    return <main className="loading-state">正在打开今天的任务…</main>;
  }

  return (
    <main className="app-shell">
      <p className="site-title">ADHD，目标已落地</p>
      <header className="topbar">
        <div>
          <p className="eyebrow">DAILY BINGO</p>
          <h1>今天，做一点就很好。</h1>
        </div>
        <div className="topbar-actions">
          <a className="mode-switch" href="./final-call/">
            <span>帮你</span>
            <span>选择</span>
          </a>
          <div className="date-badge" aria-label="今天">
            <span>{new Intl.DateTimeFormat("zh-CN", { month: "short" }).format(new Date())}</span>
            <strong>{new Date().getDate()}</strong>
          </div>
        </div>
      </header>

      <section className="progress-card" aria-labelledby="progress-title">
        <div className="progress-copy">
          <div className="progress-title-line">
            <p id="progress-title">今日进度</p>
            <strong>
              {canShowBoard ? `${completedCount} / ${size}` : "等待任务"}
            </strong>
          </div>
          <span>{progress}%</span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </section>

      <section className={`board-section${canShowBoard ? "" : " board-empty"}`} aria-labelledby="board-title">
        <div className="section-heading board-toolbar">
          <div>
            <p className="eyebrow">{canShowBoard ? `${size} × ${size} BOARD` : "YOUR BOARD"}</p>
            <h2 id="board-title">任务棋盘</h2>
          </div>
          <div className="board-tools" aria-label="棋盘工具">
            {canShowBoard && (
              <span className={winningLines.length ? "bingo-pill active" : "bingo-pill"}>
                {winningLines.length ? `BINGO × ${winningLines.length}` : "连成一线即 BINGO"}
              </span>
            )}
            <button type="button" onClick={() => setActivePanel("tasks")}>
              任务 <span>{tasks.length}</span>
            </button>
          </div>
        </div>

        {canShowBoard ? (
          <>
          <div
            className={`bingo-grid size-${size}`}
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
          >
            {board.map((slot, index) => (
              <button
                key={`${slot.task.id}-${index}`}
                type="button"
                className={`bingo-cell${slot.task.completed ? " completed" : ""}${winningCells.has(index) ? " winning" : ""}`}
                aria-pressed={slot.task.completed}
                aria-label={`${slot.task.title}${slot.repeated ? "，重复格" : ""}${slot.task.completed ? "，已完成" : "，未完成"}`}
                onClick={() => toggleTask(slot.task.id)}
              >
                <span className="cell-check" aria-hidden="true">✓</span>
                <span className="cell-title">{slot.task.title}</span>
                {slot.repeated && <span className="repeat-mark">重复</span>}
              </button>
            ))}
          </div>
          <p className="board-hint">轻点格子完成任务，再点一次即可取消。重复格会同步变化。</p>
          </>
        ) : (
          <div className="empty-board-content">
          <div className="empty-grid" aria-hidden="true">
            {Array.from({ length: 9 }, (_, index) => <span key={index} />)}
          </div>
          <div>
            <h2 id="empty-title">先放进 5 件想做的事</h2>
            <p>还需添加 {tasksNeeded} 个任务。</p>
            <button type="button" className="empty-add-button" onClick={() => setActivePanel("tasks")}>
              添加任务
            </button>
          </div>
          </div>
        )}
      </section>

      <section className="history-card" aria-labelledby="history-title">
        <div className="section-heading history-heading">
          <div>
            <p className="eyebrow">BINGO HISTORY</p>
            <h2 id="history-title">完成记录</h2>
          </div>
          <span className="history-count">{bingoHistory.length} 天</span>
        </div>
        {bingoHistory.length ? (
          <ul className="history-list">
            {bingoHistory.map((date, index) => (
              <li key={date}>
                <span className="history-dot" aria-hidden="true">{index === 0 ? "★" : "✓"}</span>
                <span>{formatHistoryDate(date)}</span>
                {date === localDateKey() && <strong>今天</strong>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="history-empty">第一次连成一条线后，日期会自动出现在这里。</p>
        )}
      </section>

      {activePanel && (
        <div className="panel-backdrop" role="presentation" onClick={() => setActivePanel(null)}>
          <aside
            className="panel-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-editor-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-sheet-top">
              <span aria-hidden="true" />
              <button type="button" aria-label="关闭" onClick={() => setActivePanel(null)}>×</button>
            </div>

      <section className="task-editor panel-content" aria-labelledby="task-editor-title">
        <div className="section-heading editor-heading">
          <div>
            <p className="eyebrow">TASKS</p>
            <h2 id="task-editor-title">我的任务</h2>
          </div>
          <span className="task-count">{tasks.length} / {MAX_TASKS}</span>
        </div>

        <form className="task-form" onSubmit={addTask}>
          <label className="sr-only" htmlFor="task-input">新任务</label>
          <input
            id="task-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={28}
            placeholder="例如：喝一杯水"
            autoComplete="off"
          />
          <button type="submit" disabled={tasks.length >= MAX_TASKS}>添加</button>
        </form>
        {message && <p className="form-message" role="status">{message}</p>}

        {tasks.length > 0 ? (
          <ul className="task-list">
            {tasks.map((task, index) => (
              <li key={task.id}>
                <button
                  className="task-toggle"
                  type="button"
                  aria-pressed={task.completed}
                  onClick={() => toggleTask(task.id)}
                >
                  <span className="task-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className={task.completed ? "task-name done" : "task-name"}>{task.title}</span>
                  <span className="mini-check" aria-hidden="true">✓</span>
                </button>
                <button
                  className="remove-task"
                  type="button"
                  aria-label={`删除任务：${task.title}`}
                  onClick={() => removeTask(task.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-tasks">这里还是空的。写下第一件小事吧。</p>
        )}
      </section>
          </aside>
        </div>
      )}

      {showBingo && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowBingo(false)}>
          <section
            className="bingo-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bingo-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-burst" aria-hidden="true">✦</div>
            <p className="eyebrow">NICE WORK</p>
            <h2 id="bingo-title">BINGO!</h2>
            <p>{bingoCelebrationMessage(winningLines.length, allTasksCompleted)}</p>
            <button type="button" onClick={() => setShowBingo(false)}>继续</button>
          </section>
        </div>
      )}
    </main>
  );
}
