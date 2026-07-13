"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type DecisionCategory = {
  id: string;
  name: string;
  options: string[];
};

type Choice = {
  categoryId: string;
  categoryName: string;
  option: string;
};

type SavedDecisionState = {
  categories: DecisionCategory[];
  selectedCategoryId?: string;
  confirmedChoice?: Choice | null;
  defaultsVersion?: number;
};

const STORAGE_KEY = "final-call-state-v1";
const BINGO_STORAGE_KEY = "daily-bingo-state-v1";
const BINGO_IMPORT_CATEGORY_ID = "bingo-unfinished";
const BINGO_IMPORT_CATEGORY_NAME = "先做哪一个？";
const DEFAULTS_VERSION = 2;
const DEFAULT_CATEGORIES: DecisionCategory[] = [
  { id: BINGO_IMPORT_CATEGORY_ID, name: BINGO_IMPORT_CATEGORY_NAME, options: [] },
  { id: "food", name: "今天吃什么？", options: [] },
  { id: "shows", name: "今天看什么剧？", options: [] },
];

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function localDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function FinalCallPage() {
  const today = new Date();
  const [categories, setCategories] = useState<DecisionCategory[]>(DEFAULT_CATEGORIES);
  const [selectedCategoryId, setSelectedCategoryId] = useState(DEFAULT_CATEGORIES[0].id);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [optionDraft, setOptionDraft] = useState("");
  const [drawnChoice, setDrawnChoice] = useState<Choice | null>(null);
  const [confirmedChoice, setConfirmedChoice] = useState<Choice | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryEditDraft, setCategoryEditDraft] = useState("");
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [optionEditDraft, setOptionEditDraft] = useState("");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- Device-local data is restored after the browser mounts. */
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as SavedDecisionState;
        if (Array.isArray(parsed.categories)) {
          let restored = parsed.categories
            .filter((category) => category && typeof category.name === "string")
            .map((category) => ({
              id: String(category.id || createId()),
              name: category.name.trim(),
              options: Array.isArray(category.options)
                ? category.options.filter((option): option is string => typeof option === "string" && Boolean(option.trim()))
                : [],
            }))
            .filter((category) => category.name);

          let restoredSelectedId = parsed.selectedCategoryId ? String(parsed.selectedCategoryId) : "";
          if (parsed.defaultsVersion !== DEFAULTS_VERSION) {
            const existingImportCategory = restored.find(
              (category) => category.id === BINGO_IMPORT_CATEGORY_ID || category.name === BINGO_IMPORT_CATEGORY_NAME,
            );
            if (existingImportCategory) {
              restored = [
                { ...existingImportCategory, id: BINGO_IMPORT_CATEGORY_ID },
                ...restored.filter((category) => category !== existingImportCategory),
              ];
              if (restoredSelectedId === existingImportCategory.id) {
                restoredSelectedId = BINGO_IMPORT_CATEGORY_ID;
              }
            } else {
              restored = [DEFAULT_CATEGORIES[0], ...restored];
            }
          }

          setCategories(restored);
          setSelectedCategoryId(
            restored.some((category) => category.id === restoredSelectedId)
              ? restoredSelectedId
              : restored[0]?.id ?? "",
          );
        }
        if (parsed.confirmedChoice?.option) setConfirmedChoice(parsed.confirmedChoice);
      }
    } catch {
      setMessage("旧数据没有读取成功，可以重新添加。");
    } finally {
      setReady(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!ready) return;
    const state: SavedDecisionState = {
      categories,
      selectedCategoryId,
      confirmedChoice,
      defaultsVersion: DEFAULTS_VERSION,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [categories, confirmedChoice, ready, selectedCategoryId]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  function selectCategory(id: string) {
    setSelectedCategoryId(id);
    setDrawnChoice(null);
    setEditingCategoryId(null);
    setEditingOption(null);
    setMessage("");
  }

  function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = categoryDraft.trim();
    if (!name) return;
    if (categories.some((category) => category.name === name)) {
      setMessage("这个类别已经有了。");
      return;
    }
    const category = { id: createId(), name, options: [] };
    setCategories((current) => [...current, category]);
    setSelectedCategoryId(category.id);
    setCategoryDraft("");
    setDrawnChoice(null);
    setMessage("");
  }

  function removeCategory(id: string) {
    setCategories((current) => {
      const next = current.filter((category) => category.id !== id);
      if (selectedCategoryId === id) setSelectedCategoryId(next[0]?.id ?? "");
      return next;
    });
    if (drawnChoice?.categoryId === id) setDrawnChoice(null);
    if (confirmedChoice?.categoryId === id) setConfirmedChoice(null);
  }

  function importUnfinishedBingoTasks() {
    if (selectedCategory?.id !== BINGO_IMPORT_CATEGORY_ID) return;

    let options: string[] = [];
    let importFailed = false;
    try {
      const saved = window.localStorage.getItem(BINGO_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          date?: string;
          tasks?: Array<{ title?: unknown; completed?: unknown }>;
        };
        const isToday = parsed.date === localDateKey();
        if (Array.isArray(parsed.tasks)) {
          options = parsed.tasks
            .filter((task) => typeof task?.title === "string" && (!isToday || !task.completed))
            .map((task) => String(task.title).trim())
            .filter(Boolean);
        }
      }
    } catch {
      importFailed = true;
    }

    setCategories((current) =>
      current.map((category) =>
        category.id === BINGO_IMPORT_CATEGORY_ID ? { ...category, options } : category,
      ),
    );
    setOptionDraft("");
    setEditingOption(null);
    setDrawnChoice((current) =>
      current?.categoryId === BINGO_IMPORT_CATEGORY_ID ? null : current,
    );
    setConfirmedChoice((current) =>
      current?.categoryId === BINGO_IMPORT_CATEGORY_ID ? null : current,
    );
    setMessage(
      importFailed
        ? "BINGO 任务读取失败，当前类别已清空。"
        : options.length > 0
          ? `已导入 ${options.length} 个未完成任务。`
          : "BINGO 暂时没有未完成任务，当前类别已清空。",
    );
  }

  function startCategoryEdit() {
    if (!selectedCategory) return;
    setEditingCategoryId(selectedCategory.id);
    setCategoryEditDraft(selectedCategory.name);
    setEditingOption(null);
    setMessage("");
  }

  function updateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCategory) return;
    const name = categoryEditDraft.trim();
    if (!name) return;
    if (categories.some((category) => category.id !== selectedCategory.id && category.name === name)) {
      setMessage("这个类别名称已经有了。");
      return;
    }
    setCategories((current) =>
      current.map((category) =>
        category.id === selectedCategory.id ? { ...category, name } : category,
      ),
    );
    setDrawnChoice((current) =>
      current?.categoryId === selectedCategory.id ? { ...current, categoryName: name } : current,
    );
    setConfirmedChoice((current) =>
      current?.categoryId === selectedCategory.id ? { ...current, categoryName: name } : current,
    );
    setEditingCategoryId(null);
    setMessage("");
  }

  function addOption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const option = optionDraft.trim();
    if (!selectedCategory || !option) return;
    if (selectedCategory.options.includes(option)) {
      setMessage("这个选项已经在当前类别里了。");
      return;
    }
    setCategories((current) =>
      current.map((category) =>
        category.id === selectedCategory.id
          ? { ...category, options: [...category.options, option] }
          : category,
      ),
    );
    setOptionDraft("");
    setMessage("");
  }

  function removeOption(option: string) {
    if (!selectedCategory) return;
    setCategories((current) =>
      current.map((category) =>
        category.id === selectedCategory.id
          ? { ...category, options: category.options.filter((item) => item !== option) }
          : category,
      ),
    );
    if (drawnChoice?.categoryId === selectedCategory.id && drawnChoice.option === option) setDrawnChoice(null);
    if (confirmedChoice?.categoryId === selectedCategory.id && confirmedChoice.option === option) setConfirmedChoice(null);
  }

  function startOptionEdit(option: string) {
    setEditingOption(option);
    setOptionEditDraft(option);
    setEditingCategoryId(null);
    setMessage("");
  }

  function updateOption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCategory || editingOption === null) return;
    const option = optionEditDraft.trim();
    if (!option) return;
    if (selectedCategory.options.some((item) => item !== editingOption && item === option)) {
      setMessage("这个选项已经在当前类别里了。");
      return;
    }
    const previousOption = editingOption;
    setCategories((current) =>
      current.map((category) =>
        category.id === selectedCategory.id
          ? { ...category, options: category.options.map((item) => item === previousOption ? option : item) }
          : category,
      ),
    );
    setDrawnChoice((current) =>
      current?.categoryId === selectedCategory.id && current.option === previousOption
        ? { ...current, option }
        : current,
    );
    setConfirmedChoice((current) =>
      current?.categoryId === selectedCategory.id && current.option === previousOption
        ? { ...current, option }
        : current,
    );
    setEditingOption(null);
    setMessage("");
  }

  function drawChoice() {
    if (!selectedCategory || selectedCategory.options.length === 0) {
      setMessage("先给这个类别添加至少一个选项吧。");
      return;
    }
    const alternatives = selectedCategory.options.filter(
      (option) => option !== drawnChoice?.option,
    );
    const pool = alternatives.length ? alternatives : selectedCategory.options;
    const option = pool[Math.floor(Math.random() * pool.length)];
    setDrawnChoice({
      categoryId: selectedCategory.id,
      categoryName: selectedCategory.name,
      option,
    });
    setMessage("");
  }

  function confirmChoice() {
    if (!drawnChoice) return;
    setConfirmedChoice(drawnChoice);
    setDrawnChoice(null);
  }

  if (!ready) return <main className="loading-state">正在准备选择器…</main>;

  return (
    <main className="app-shell">
      <p className="site-title">ADHD，目标已落地</p>
      <header className="topbar">
        <div>
          <p className="eyebrow">FINAL CALL</p>
          <h1>今天，不再恐惧选择。</h1>
        </div>
        <div className="topbar-actions">
          <a className="mode-switch" href="../">
            <span>任务</span>
            <span>连线</span>
          </a>
          <div className="date-badge" aria-label="今天">
            <span>{new Intl.DateTimeFormat("zh-CN", { month: "short" }).format(today)}</span>
            <strong>{today.getDate()}</strong>
          </div>
        </div>
      </header>

      {confirmedChoice && (
        <section className="confirmed-choice" aria-live="polite">
          <p className="confirmed-label">今天就选这个</p>
          <span className="confirmed-category">{confirmedChoice.categoryName}</span>
          <strong>{confirmedChoice.option}</strong>
          <button type="button" onClick={() => setConfirmedChoice(null)}>重新决定</button>
        </section>
      )}

      <div className="decision-sections">
      <section className="decision-card" aria-labelledby="category-title">
        <div className="section-heading decision-heading">
          <div>
            <p className="eyebrow">CATEGORIES</p>
            <h2 id="category-title">要决定什么？</h2>
          </div>
          <span className="decision-count">{categories.length} 类</span>
        </div>

        {categories.length > 0 ? (
          <div className="category-tabs" role="tablist" aria-label="选择类别">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={category.id === selectedCategoryId}
                className={category.id === selectedCategoryId ? "active" : ""}
                onClick={() => selectCategory(category.id)}
              >
                {category.name}
                <span>{category.options.length}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="decision-empty">还没有类别，先在下面添加一个吧。</p>
        )}

        <form className="decision-form" onSubmit={addCategory}>
          <input
            value={categoryDraft}
            onChange={(event) => setCategoryDraft(event.target.value)}
            maxLength={30}
            placeholder="添加新类别，例如：周末去哪？"
            aria-label="新类别名称"
          />
          <button type="submit" disabled={!categoryDraft.trim()}>添加类别</button>
        </form>
      </section>

      {selectedCategory && (
        <section className="decision-card option-card" aria-labelledby="option-title">
          <div className="section-heading decision-heading">
            <div>
              <p className="eyebrow">OPTIONS</p>
              <div className="editable-title-row">
                <h2 id="option-title">{selectedCategory.name}</h2>
                <button className="edit-text-button" type="button" onClick={startCategoryEdit}>修改</button>
              </div>
            </div>
            <div className="category-actions">
              {selectedCategory.id === BINGO_IMPORT_CATEGORY_ID && (
                <button className="delete-category" type="button" onClick={importUnfinishedBingoTasks}>
                  一键导入
                </button>
              )}
              <button className="delete-category" type="button" onClick={() => removeCategory(selectedCategory.id)}>
                删除类别
              </button>
            </div>
          </div>

          {editingCategoryId === selectedCategory.id && (
            <form className="inline-edit-form category-edit-form" onSubmit={updateCategory}>
              <input
                value={categoryEditDraft}
                onChange={(event) => setCategoryEditDraft(event.target.value)}
                maxLength={30}
                aria-label="修改类别名称"
                autoFocus
              />
              <button type="submit">保存</button>
              <button type="button" onClick={() => setEditingCategoryId(null)}>取消</button>
            </form>
          )}

          <form className="decision-form" onSubmit={addOption}>
            <input
              value={optionDraft}
              onChange={(event) => setOptionDraft(event.target.value)}
              maxLength={50}
              placeholder="添加一个可选项"
              aria-label={`给${selectedCategory.name}添加选项`}
            />
            <button type="submit" disabled={!optionDraft.trim()}>添加</button>
          </form>

          {selectedCategory.options.length > 0 ? (
            <ul className="option-list">
              {selectedCategory.options.map((option) => (
                <li key={option} className={editingOption === option ? "editing" : ""}>
                  {editingOption === option ? (
                    <form className="inline-edit-form option-edit-form" onSubmit={updateOption}>
                      <input
                        value={optionEditDraft}
                        onChange={(event) => setOptionEditDraft(event.target.value)}
                        maxLength={50}
                        aria-label={`修改${option}`}
                        autoFocus
                      />
                      <button type="submit">保存</button>
                      <button type="button" onClick={() => setEditingOption(null)}>取消</button>
                    </form>
                  ) : (
                    <>
                      <span>{option}</span>
                      <div className="option-actions">
                        <button className="edit-option" type="button" onClick={() => startOptionEdit(option)}>修改</button>
                        <button className="remove-option" type="button" aria-label={`删除${option}`} onClick={() => removeOption(option)}>×</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="decision-empty">这里还没有选项，想到什么就加进来。</p>
          )}

          {message && <p className="decision-message" role="status">{message}</p>}

          <button className="decide-button" type="button" onClick={drawChoice}>
            帮我决定
          </button>

        </section>
      )}
      </div>

      {drawnChoice && (
        <div className="modal-backdrop" role="presentation" onClick={() => setDrawnChoice(null)}>
          <section
            className="decision-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="decision-result-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-burst" aria-hidden="true">✦</div>
            <p className="eyebrow">FINAL CALL</p>
            <p className="decision-result-label">命运替我决定了</p>
            <h2 id="decision-result-title">{drawnChoice.option}</h2>
            <p className="decision-result-category">{drawnChoice.categoryName}</p>
            <div className="draw-actions">
              <button type="button" className="confirm-button" onClick={confirmChoice}>确定</button>
              <button type="button" className="redraw-button" onClick={drawChoice}>再换一个</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
