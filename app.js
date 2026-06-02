// ===== 数据管理 =====
const Store = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch { return null; }
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }
};

// 记录用户手动编辑过的项目名称集合（用于重新计算时的精确覆盖）
let editedProjects = new Set();

// ===== 用户名管理 =====

const DEFAULT_USER_NAME = '小铃';

function loadUserName() {
  return Store.get('userName') || DEFAULT_USER_NAME;
}

function saveUserName(name) {
  Store.set('userName', name);
}

function getAppDisplayName() {
  return `${loadUserName()}的预算`;
}

function renderAppTitle() {
  document.getElementById('appTitle').textContent = getAppDisplayName();
  document.title = `${getAppDisplayName()}管理系统`;
}

function renameUserName() {
  const current = loadUserName();
  const input = prompt('请输入你的名字：', current);
  if (input === null || input.trim() === '') return;
  const trimmed = input.trim();
  if (trimmed === current) return;
  saveUserName(trimmed);
  renderAppTitle();
}

// 默认莫兰迪色板
const MORANDI_COLORS = [
  '#b8a9c0', '#a3b5a0', '#c9a0a0', '#a0b8c9', '#c4b89e',
  '#d4c8db', '#bccfb8', '#d9bfbf', '#b8d0df', '#d9d0b8',
  '#c2a8d1', '#8fb3a1', '#d4a8a8', '#8faab8', '#bfb49a',
  '#e0d4e8', '#c8dcc4', '#e6cccc', '#c4dce6', '#e2dcc8'
];

// 默认设置
function getDefaultSettings() {
  const now = new Date();
  return {
    totalBudget: 6000,
    plannedSaving: 200,
    budgetStartYear: now.getFullYear(),
    budgetStartMonth: now.getMonth() + 1,
    budgetStartDay: 1,
    budgetEndYear: now.getFullYear(),
    budgetEndMonth: now.getMonth() + 1,
    budgetEndDay: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    fixedExpenses: [
      { name: '房租', amount: 1388 },
      { name: 'Cursor会员', amount: 60 }
    ],
    projects: [
      { name: '早餐', percent: 15, color: '#a3b5a0' },
      { name: '午晚餐', percent: 35, color: '#c9a0a0' },
      { name: '日用', percent: 15, color: '#a0b8c9' },
      { name: 'Token', percent: 15, color: '#c4b89e' },
      { name: '弹性消费', percent: 20, color: '#b8a9c0' }
    ]
  };
}

// 获取当前月份的存储key前缀
function getMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// 获取本月天数
function getDaysInMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

// 获取今天是本月第几天
function getTodayDate() {
  return new Date().getDate();
}

// 获取本月剩余天数（包括今天）
function getRemainingDays() {
  return getDaysInMonth() - getTodayDate() + 1;
}

// 获取有效剩余天数（优先使用手动值，否则使用自动计算值）
function getEffectiveRemainingDays() {
  const daily = loadDailyData();
  if (daily.manualRemainingDays !== undefined && daily.manualRemainingDays !== null && daily.manualRemainingDays > 0) {
    return daily.manualRemainingDays;
  }
  return getPlannedRemainingDays();
}

// 判断今天是否在设置的预算周期内
function isInBudgetPeriod() {
  const settings = loadSettings();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  const startYear = settings.budgetStartYear || currentYear;
  const startMonth = settings.budgetStartMonth || 1;
  const startDay = settings.budgetStartDay || 1;
  const endYear = settings.budgetEndYear || currentYear;
  const endMonth = settings.budgetEndMonth || currentMonth;
  const endDay = settings.budgetEndDay || 28;

  const startDate = new Date(startYear, startMonth - 1, startDay);
  const endDate = new Date(endYear, endMonth - 1, endDay);
  const today = new Date(currentYear, currentMonth - 1, currentDay);

  return today >= startDate && today <= endDate;
}

// 获取计划周期总天数（起始日到结束日）
function getPlannedTotalDays() {
  const settings = loadSettings();
  const startYear = settings.budgetStartYear || new Date().getFullYear();
  const startMonth = settings.budgetStartMonth || (new Date().getMonth() + 1);
  const startDay = settings.budgetStartDay || 1;
  const endYear = settings.budgetEndYear || startYear;
  const endMonth = settings.budgetEndMonth || startMonth;
  const endDay = settings.budgetEndDay || startDay;

  const startDate = new Date(startYear, startMonth - 1, startDay);
  const endDate = new Date(endYear, endMonth - 1, endDay);
  const diffMs = endDate - startDate;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

// 获取基于计划周期的剩余天数（不含手动修正）
function getPlannedRemainingDays() {
  const settings = loadSettings();
  const now = new Date();
  const currentDay = now.getDate();
  const startDay = settings.budgetStartDay || 1;
  const endDay = settings.budgetEndDay || currentDay;

  if (currentDay < startDay) {
    return endDay - startDay + 1;
  }
  return Math.max(0, endDay - currentDay + 1);
}

// 加载设置
function loadSettings() {
  const key = `settings_${getMonthKey()}`;
  return Store.get(key) || getDefaultSettings();
}

// 判断本月是否已有设置（区分「从未配置」和「有默认值填充」）
function hasSettings() {
  const key = `settings_${getMonthKey()}`;
  return localStorage.getItem(key) !== null;
}

// 保存设置
function saveSettings(settings) {
  const key = `settings_${getMonthKey()}`;
  Store.set(key, settings);
}

// 加载每日记录
function loadDailyData() {
  const key = `daily_${getMonthKey()}`;
  return Store.get(key) || {};
}

// 保存每日记录
function saveDailyData(data) {
  const key = `daily_${getMonthKey()}`;
  Store.set(key, data);
}

// 加载存钱罐
function loadPiggy() {
  return Store.get('piggy') || { total: 0, records: [] };
}

// 保存存钱罐
function savePiggy(piggy) {
  Store.set('piggy', piggy);
}

// 计算固定开支总额
function calcFixedTotal(settings) {
  return settings.fixedExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
}

// 计算实际可分配金额
function calcDistributable(settings) {
  return settings.totalBudget - calcFixedTotal(settings) - settings.plannedSaving;
}
// ===== 核心计算 =====

// 获取项目每月预算数组
function getProjectMonthlyBudgets(settings) {
  const distributable = calcDistributable(settings);
  const totalDays = getPlannedTotalDays();
  return settings.projects.map(p => ({
    ...p,
    monthlyBudget: Math.round(distributable * p.percent / 100),
    monthlyDailyAvg: Math.round(distributable * p.percent / 100 / totalDays)
  }));
}

// 获取项目已使用金额（基于每日记录中的项目调整）
function getProjectUsed(settings) {
  // 简化模式：按总花费按比例分配到各项目
  // 也支持手动调整记录
  const daily = loadDailyData();
  const used = {};
  settings.projects.forEach(p => { used[p.name] = 0; });

  // 如果有按项目记录的调整数据，读取时主动清理已删除项目的孤立 key
  if (daily.projectAdjustments) {
    const currentProjectNames = new Set(settings.projects.map(p => p.name));
    Object.keys(daily.projectAdjustments).forEach(name => {
      if (currentProjectNames.has(name)) {
        used[name] = daily.projectAdjustments[name];
      }
    });
    Object.keys(daily.projectAdjustments).forEach(name => {
      if (!currentProjectNames.has(name)) {
        delete daily.projectAdjustments[name];
      }
    });
    saveDailyData(daily);
    return used;
  }

  // 否则按比例分配已花费总额
  const totalSpent = calcTotalSpent();
  settings.projects.forEach(p => {
    used[p.name] = Math.round(totalSpent * p.percent / 100);
  });
  return used;
}

// 计算已花费总额
function calcTotalSpent() {
  const settings = loadSettings();
  const daily = loadDailyData();
  const distributable = calcDistributable(settings);

  if (daily.remainingDistributable !== undefined) {
    return Math.max(0, distributable - daily.remainingDistributable);
  }
  return 0;
}

// 获取当前剩余可分配金额
function getRemainingDistributable() {
  const daily = loadDailyData();
  const settings = loadSettings();
  if (daily.remainingDistributable !== undefined) {
    return daily.remainingDistributable;
  }
  return calcDistributable(settings);
}

// 计算今日各项目推荐额度
function calcTodayProjectAllowances(settings, customOverrides) {
  const remaining = getRemainingDistributable();
  const days = getEffectiveRemainingDays();
  const todayTotal = Math.round(remaining / days);
  const projects = getProjectMonthlyBudgets(settings);

  let allowances = projects.map(p => {
    const projectRemaining = p.monthlyBudget - (getProjectUsed(settings)[p.name] || 0);
    const projectDaily = Math.round(Math.max(0, projectRemaining) / days);
    return {
      name: p.name,
      color: p.color,
      percent: p.percent,
      monthlyBudget: p.monthlyBudget,
      monthlyDailyAvg: p.monthlyDailyAvg,
      remaining: Math.max(0, projectRemaining),
      todayAllowance: projectDaily
    };
  });

  // 应用手动覆盖
  if (customOverrides) {
    let overriddenTotal = 0;
    let remainingPercent = 0;
    const overriddenNames = Object.keys(customOverrides);

    overriddenNames.forEach(name => {
      const proj = allowances.find(a => a.name === name);
      if (proj) {
        proj.todayAllowance = customOverrides[name];
        overriddenTotal += customOverrides[name];
      }
    });

    // 剩余金额按比例分配给未手动调整的项目
    const leftover = todayTotal - overriddenTotal;
    const nonOverridden = allowances.filter(a => !overriddenNames.includes(a.name));
    const totalNonPercent = nonOverridden.reduce((s, a) => s + a.percent, 0);

    if (totalNonPercent > 0 && leftover > 0) {
      nonOverridden.forEach(a => {
        a.todayAllowance = Math.round(leftover * a.percent / totalNonPercent);
      });
    } else if (leftover <= 0) {
      nonOverridden.forEach(a => { a.todayAllowance = 0; });
    }
  }

  return { todayTotal, allowances };
}
// ===== UI 渲染 =====

function renderOverview() {
  const settings = loadSettings();
  const daily = loadDailyData();
  const distributable = calcDistributable(settings);
  const remaining = getRemainingDistributable();
  const days = getEffectiveRemainingDays();
  const plannedTotalDays = getPlannedTotalDays();
  const recommendedDaily = plannedTotalDays > 0 ? Math.round((settings.totalBudget - calcFixedTotal(settings) - settings.plannedSaving) / plannedTotalDays) : 0;

  document.getElementById('remainingAmount').textContent = `¥${remaining}`;
  document.getElementById('initialAmount').textContent = `月初: ¥${settings.totalBudget}`;
  document.getElementById('remainingDays').textContent = `剩余${days}天`;
  document.getElementById('fixedTotal').textContent = `¥${calcFixedTotal(settings)}`;
  document.getElementById('plannedSaving').textContent = `¥${settings.plannedSaving}`;
  document.getElementById('recommendedDaily').textContent = `¥${recommendedDaily}`;

  // 回填手动剩余天数
  const daysInput = document.getElementById('remainingDaysInput');
  if (daily.manualRemainingDays !== undefined && daily.manualRemainingDays !== null) {
    daysInput.value = daily.manualRemainingDays;
  } else {
    daysInput.value = '';
  }
}

function renderFixedDetail() {
  const settings = loadSettings();
  const list = document.getElementById('fixedDetailList');
  list.innerHTML = '';
  settings.fixedExpenses.forEach(e => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${e.name}</span><span>¥${e.amount}</span>`;
    list.appendChild(li);
  });
}

function renderToday() {
  const settings = loadSettings();
  const daily = loadDailyData();
  const { todayTotal } = calcTodayProjectAllowances(settings, daily.todayOverrides);

  document.getElementById('todaySuggest').textContent = `<¥${todayTotal}`;

  // 昨日实际花费
  const infoEl = document.getElementById('yesterdayInfo');
  if (daily.yesterdaySpent !== undefined) {
    infoEl.innerHTML = `<span class="yesterday-spent">昨日花费 ¥${daily.yesterdaySpent}</span>`;
  } else {
    infoEl.innerHTML = '';
  }
}

function renderProjects() {
  const settings = loadSettings();
  const daily = loadDailyData();
  const { allowances } = calcTodayProjectAllowances(settings, daily.todayOverrides);
  const grid = document.getElementById('projectsGrid');
  grid.innerHTML = '';

  allowances.forEach(proj => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.style.background = proj.color;
    card.style.color = getContrastColor(proj.color);

    const currentOverride = daily.todayOverrides ? daily.todayOverrides[proj.name] : null;
    const displayVal = (currentOverride !== undefined && currentOverride !== null) ? currentOverride : proj.todayAllowance;
    card.innerHTML = `
      <div class="proj-name">${proj.name}</div>
      <div class="proj-amount" data-project="${proj.name}">¥${displayVal}</div>
      <input class="proj-amount-input hidden" type="number"
        data-project="${proj.name}" value="${displayVal}">
      <div class="proj-monthly hidden">
        <div>计划日均 ¥${proj.monthlyDailyAvg}</div>
        <div>计划月费 ¥${proj.monthlyBudget}</div>
      </div>
    `;

    // 点击切换编辑模式
    const amountDiv = card.querySelector('.proj-amount');
    const amountInput = card.querySelector('.proj-amount-input');
    const monthlyDiv = card.querySelector('.proj-monthly');

    amountDiv.addEventListener('click', (e) => {
      e.stopPropagation();
      amountDiv.classList.add('hidden');
      amountInput.classList.remove('hidden');
      amountInput.focus();
      amountInput.select();
    });

    amountInput.addEventListener('blur', () => {
      const val = parseInt(amountInput.value) || 0;
      amountDiv.textContent = `¥${val}`;
      amountDiv.classList.remove('hidden');
      amountInput.classList.add('hidden');
      saveOverride(proj.name, val);
      renderAll();
    });

    amountInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') amountInput.blur();
    });

    // 点击卡片展开月度信息
    card.addEventListener('click', () => {
      monthlyDiv.classList.toggle('hidden');
    });

    // 用 wrapper 包裹卡片，使高度变化隔离在单个容器内
    const wrapper = document.createElement('div');
    wrapper.className = 'project-card-wrapper';
    wrapper.appendChild(card);

    grid.appendChild(wrapper);
  });
}

// 根据背景色计算文字颜色
function getContrastColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#4a4a4a' : '#ffffff';
}

// 保存手动覆盖
function saveOverride(name, value) {
  const daily = loadDailyData();
  if (!daily.todayOverrides) daily.todayOverrides = {};
  daily.todayOverrides[name] = value;
  saveDailyData(daily);
  editedProjects.add(name);
}

// 完整渲染
function renderAll() {
  if (!hasSettings()) {
    document.getElementById('remainingAmount').textContent = '¥0';
    document.getElementById('initialAmount').textContent = '月初: ¥0';
    document.getElementById('remainingDays').textContent = '剩余0天';
    document.getElementById('fixedTotal').textContent = '¥0';
    document.getElementById('plannedSaving').textContent = '¥0';
    document.getElementById('recommendedDaily').textContent = '¥0';
    document.getElementById('todaySuggest').textContent = '<¥0';
    document.getElementById('yesterdayInfo').innerHTML = '';
    document.getElementById('fixedDetailList').innerHTML = '';
    document.getElementById('projectsGrid').innerHTML = '';
    document.getElementById('remainingDaysInput').value = '';
    return;
  }
  renderOverview();
  renderFixedDetail();
  renderToday();
  renderProjects();
}
// ===== 事件绑定 =====

function bindEvents() {
  // 固定开支展开/收起
  document.getElementById('fixedExpenseToggle').addEventListener('click', () => {
    document.getElementById('fixedDetail').classList.toggle('hidden');
  });

  // 标题栏用户名点击重命名
  document.getElementById('appTitle').addEventListener('click', renameUserName);

  // 合并按钮（余额更新 + 重新计算）
  document.getElementById('btnUpdate').addEventListener('click', handleMerge);

  // 手动设置剩余天数
  document.getElementById('remainingDaysInput').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    const daily = loadDailyData();
    if (!isNaN(val) && val > 0) {
      daily.manualRemainingDays = val;
    } else {
      daily.manualRemainingDays = null;
    }
    saveDailyData(daily);
    renderAll();
  });

  // 存钱罐
  document.getElementById('btnPiggy').addEventListener('click', () => openModal('piggyModal'));
  document.getElementById('closePiggy').addEventListener('click', () => closeModal('piggyModal'));
  document.getElementById('btnResetPiggy').addEventListener('click', handleResetPiggy);

  // 存钱罐操作
  document.getElementById('btnWithdraw').addEventListener('click', () => openPiggyAction('withdraw'));
  document.getElementById('btnDeposit').addEventListener('click', () => openPiggyAction('deposit'));
  document.getElementById('closePiggyAction').addEventListener('click', () => closeModal('piggyActionModal'));
  document.getElementById('btnConfirmPiggyAction').addEventListener('click', handlePiggyAction);

  // 存档
  document.getElementById('btnArchive').addEventListener('click', toggleArchiveMenu);
  document.getElementById('btnScreenshot').addEventListener('click', () => { closeArchiveMenu(); handleScreenshot(); });
  document.getElementById('btnTextReport').addEventListener('click', () => { closeArchiveMenu(); openModal('reportModal'); });
  document.getElementById('btnExportBackup').addEventListener('click', () => { closeArchiveMenu(); handleExportBackup(); });
  document.getElementById('btnImportBackup').addEventListener('click', () => { closeArchiveMenu(); document.getElementById('backupFileInput').click(); });
  document.getElementById('backupFileInput').addEventListener('change', handleImportBackup);
  document.getElementById('closeReport').addEventListener('click', () => closeModal('reportModal'));
  document.getElementById('btnCopyReport').addEventListener('click', handleCopyReport);

  // 设置
  document.getElementById('btnSettings').addEventListener('click', openSettings);
  document.getElementById('closeSettings').addEventListener('click', () => closeModal('settingsModal'));
  document.getElementById('btnAddFixed').addEventListener('click', addFixedExpenseRow);
  document.getElementById('btnAddProject').addEventListener('click', addProjectRow);
  document.getElementById('btnSaveSettings').addEventListener('click', handleSaveSettings);

  // 颜色选择器
  document.getElementById('closeColorPicker').addEventListener('click', () => closeModal('colorPickerModal'));

  // 重置
  document.getElementById('btnReset').addEventListener('click', openResetConfirmModal);
  document.getElementById('closeResetConfirm').addEventListener('click', closeResetConfirmModal);
  document.getElementById('btnCancelReset').addEventListener('click', closeResetConfirmModal);
  document.getElementById('btnConfirmReset').addEventListener('click', handleReset);

  // 点击遮罩关闭弹窗
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });
}

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  if (id === 'piggyModal') renderPiggy();
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}
// ===== 重置功能 =====

function openResetConfirmModal() {
  document.getElementById('resetConfirmModal').classList.remove('hidden');
}

function closeResetConfirmModal() {
  document.getElementById('resetConfirmModal').classList.add('hidden');
}

function handleReset() {
  const monthKey = getMonthKey();

  // 清除月度设置
  localStorage.removeItem(`settings_${monthKey}`);
  // 清除每日记录
  localStorage.removeItem(`daily_${monthKey}`);
  // 清除月底结转标记
  localStorage.removeItem(`transferred_${monthKey}`);

  closeResetConfirmModal();
  renderAll();

  // 弹出首次使用提示
  if (confirm(`欢迎使用${getAppDisplayName()}管理系统！\n是否现在进行月度设置？`)) {
    openSettings();
  }
}

// ===== 业务操作 =====

// 合并按钮：同时处理余额更新 + 重新计算
function handleMerge() {
  const input = document.getElementById('balanceInput');
  const newBalance = parseFloat(input.value);

  // ===== 1. 余额更新逻辑（原 handleUpdate） =====
  if (!isNaN(newBalance) && newBalance >= 0) {
    const daily = loadDailyData();

    if (daily.lastBalance !== undefined) {
      daily.yesterdaySpent = Math.max(0, daily.lastBalance - newBalance);
    }

    daily.lastBalance = newBalance;
    daily.lastUpdateDate = getTodayDate();
    daily.remainingDistributable = newBalance;

    saveDailyData(daily);
    input.value = '';
  }

  // ===== 2. 重新计算逻辑（原 handleRecalc） =====
  const settings = loadSettings();
  const daily = loadDailyData();
  const { allowances, todayTotal } = calcTodayProjectAllowances(settings, null);

  const inputs = document.querySelectorAll('.proj-amount-input');

  const inputValues = {};
  for (const inp of inputs) {
    const name = inp.dataset.project;
    const val = parseInt(inp.value) || 0;
    inputValues[name] = val;

    if (val > todayTotal) {
      alert(`"${name}" 输入了 ¥${val}，超过了"建议今日总花费" ¥${todayTotal}，请修改后再重新计算`);
      return;
    }
  }

  const editedTotal = [...editedProjects].reduce((s, name) => s + (inputValues[name] || 0), 0);
  const leftover = todayTotal - editedTotal;

  const nonEditedProjects = allowances.filter(a => !editedProjects.has(a.name));
  const nonEditedTotalPercent = nonEditedProjects.reduce((s, a) => s + a.percent, 0);

  const finalAllowances = {};
  allowances.forEach(a => {
    if (editedProjects.has(a.name)) {
      finalAllowances[a.name] = inputValues[a.name] || 0;
    } else if (nonEditedTotalPercent > 0) {
      finalAllowances[a.name] = Math.round(leftover * a.percent / nonEditedTotalPercent);
    }
  });

  daily.todayOverrides = finalAllowances;
  saveDailyData(daily);
  editedProjects.clear();

  // ===== 3. 刷新界面 =====
  renderAll();
}

// 存钱罐渲染
function renderPiggy() {
  const piggy = loadPiggy();
  document.getElementById('piggyAmount').textContent = `¥${piggy.total}`;

  const list = document.getElementById('piggyRecords');
  list.innerHTML = '';

  if (piggy.records.length === 0) {
    list.innerHTML = '<li style="color:var(--text-muted);text-align:center;padding:20px;">暂无记录</li>';
    return;
  }

  // 按时间倒序
  const sorted = [...piggy.records].reverse();
  sorted.forEach(r => {
    const li = document.createElement('li');
    const isIn = r.type === 'deposit';
    li.innerHTML = `
      <div class="record-info">
        <span>${r.note || (isIn ? '存入' : '取出')}</span>
        <span class="record-date">${r.date || '无日期'}</span>
      </div>
      <span class="${isIn ? 'record-amount-in' : 'record-amount-out'}">
        ${isIn ? '+' : '-'}¥${r.amount}
      </span>
    `;
    list.appendChild(li);
  });
}

// 存钱罐操作
let piggyActionType = 'withdraw';

function openPiggyAction(type) {
  piggyActionType = type;
  document.getElementById('piggyActionTitle').textContent = type === 'withdraw' ? '取钱' : '存入';
  document.getElementById('piggyActionAmount').value = '';
  document.getElementById('piggyActionNote').value = '';
  const today = new Date();
  const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  document.getElementById('piggyActionDate').value = defaultDate;
  openModal('piggyActionModal');
}

function handlePiggyAction() {
  const amount = parseFloat(document.getElementById('piggyActionAmount').value);
  const note = document.getElementById('piggyActionNote').value.trim();
  const dateInput = document.getElementById('piggyActionDate').value;

  if (isNaN(amount) || amount <= 0) {
    alert('请输入有效金额');
    return;
  }

  if (!dateInput) {
    alert('请输入日期');
    return;
  }

  const piggy = loadPiggy();

  if (piggyActionType === 'withdraw') {
    if (amount > piggy.total) {
      alert('余额不足');
      return;
    }
    piggy.total -= amount;
    piggy.records.push({ type: 'withdraw', amount, note: note || '取出', date: dateInput });
  } else {
    piggy.total += amount;
    piggy.records.push({ type: 'deposit', amount, note: note || '存入', date: dateInput });
  }

  savePiggy(piggy);
  closeModal('piggyActionModal');
  renderPiggy();
}

function handleResetPiggy() {
  if (!confirm('确定要重置存钱罐吗？\n所有存款和记录将被清空。')) return;
  const piggy = { total: 0, records: [] };
  savePiggy(piggy);
  renderPiggy();
}
// ===== 报表功能 =====

function handleScreenshot() {
  const target = document.getElementById('mainContent');
  if (typeof html2canvas === 'undefined') {
    alert('截图库加载中，请稍后再试');
    return;
  }
  html2canvas(target, {
    backgroundColor: '#f5f0eb',
    scale: 2,
    useCORS: true
  }).then(canvas => {
    const link = document.createElement('a');
    link.download = `预算_${getMonthKey()}_${getTodayDate()}日.png`;
    link.href = canvas.toDataURL();
    link.click();
  }).catch(err => {
    alert('截图失败: ' + err.message);
  });
}

function handleTextReport() {
  const settings = loadSettings();
  const daily = loadDailyData();
  const distributable = calcDistributable(settings);
  const remaining = getRemainingDistributable();
  const days = getEffectiveRemainingDays();
  const todayDate = getTodayDate();
  const totalDays = getPlannedTotalDays();
  const spent = distributable - remaining;
  const recommendedDaily = Math.round((settings.totalBudget - calcFixedTotal(settings) - settings.plannedSaving) / getPlannedTotalDays());
  const piggy = loadPiggy();
  const { allowances } = calcTodayProjectAllowances(settings, daily.todayOverrides);

  let report = '';
  report += `📊 ${getAppDisplayName()}报表\n`;
  report += `━━━━━━━━━━━━━━━━━━\n`;
  report += `📅 ${getMonthKey()} | 第${todayDate}天 / 共${totalDays}天\n`;
  report += `⏳ 剩余 ${days} 天\n\n`;

  report += `💰 本月总预算: ¥${settings.totalBudget}\n`;
  report += `   固定开支: ¥${calcFixedTotal(settings)}\n`;
  report += `   计划存款: ¥${settings.plannedSaving}\n`;
  report += `   可分配额: ¥${distributable}\n\n`;

  report += `📈 已花费: ¥${spent}\n`;
  report += `   剩余可用: ¥${remaining}\n`;
  report += `   推荐日支出: ¥${recommendedDaily}\n\n`;

  report += `🎯 今日建议花费: <¥${recommendedDaily}\n`;

  if (daily.yesterdaySpent !== undefined) {
    report += `   昨日实际花费: ¥${daily.yesterdaySpent}\n`;
  }
  report += `\n`;

  report += `📋 各项目明细:\n`;
  allowances.forEach(p => {
    report += `   ${p.name}: 月预算¥${p.monthlyBudget} | 剩余¥${p.remaining} | 今日¥${p.todayAllowance}\n`;
  });
  report += `\n`;

  report += `🐷 存钱罐: ¥${piggy.total}\n`;
  report += `━━━━━━━━━━━━━━━━━━\n`;

  document.getElementById('reportContent').textContent = report;
  document.getElementById('reportTextArea').classList.remove('hidden');
}

function handleCopyReport() {
  const text = document.getElementById('reportContent').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btnCopyReport');
    btn.textContent = '已复制 ✓';
    setTimeout(() => { btn.textContent = '复制到剪贴板'; }, 2000);
  }).catch(() => {
    // fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    const btn = document.getElementById('btnCopyReport');
    btn.textContent = '已复制 ✓';
    setTimeout(() => { btn.textContent = '复制到剪贴板'; }, 2000);
  });
}
// ===== 设置页面 =====

function openSettings() {
  const settings = hasSettings() ? loadSettings() : getDefaultSettings();

  document.getElementById('setTotalBudget').value = hasSettings() ? settings.totalBudget : 0;
  document.getElementById('setPlannedSaving').value = hasSettings() ? settings.plannedSaving : 0;

  // 回填预算周期日期（从未配置时显示空）
  if (hasSettings()) {
    const startYear = settings.budgetStartYear || new Date().getFullYear();
    const startMonth = settings.budgetStartMonth || (new Date().getMonth() + 1);
    const startDay = settings.budgetStartDay || 1;
    const endYear = settings.budgetEndYear || new Date().getFullYear();
    const endMonth = settings.budgetEndMonth || (new Date().getMonth() + 1);
    const endDay = settings.budgetEndDay || new Date().getDate();
    document.getElementById('setStartDate').value =
      `${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    document.getElementById('setEndDate').value =
      `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
  } else {
    document.getElementById('setStartDate').value = '';
    document.getElementById('setEndDate').value = '';
  }

  // 渲染固定开支列表
  renderFixedExpensesSettings(hasSettings() ? settings.fixedExpenses : []);

  // 渲染项目列表
  renderProjectsSettings(hasSettings() ? settings.projects : []);

  updatePercentHint();
  openModal('settingsModal');
}

function renderFixedExpensesSettings(expenses) {
  const container = document.getElementById('fixedExpensesList');
  container.innerHTML = '';
  expenses.forEach((e, i) => {
    const row = document.createElement('div');
    row.className = 'fixed-item';
    row.innerHTML = `
      <input type="text" class="input-name" value="${e.name}" placeholder="名称" data-idx="${i}">
      <input type="number" class="input-amount" value="${e.amount}" placeholder="金额" data-idx="${i}">
      <button class="btn-remove" data-idx="${i}">&times;</button>
    `;
    row.querySelector('.btn-remove').addEventListener('click', () => {
      row.remove();
    });
    container.appendChild(row);
  });
}

function addFixedExpenseRow() {
  const container = document.getElementById('fixedExpensesList');
  const row = document.createElement('div');
  row.className = 'fixed-item';
  row.innerHTML = `
    <input type="text" class="input-name" value="" placeholder="名称">
    <input type="number" class="input-amount" value="" placeholder="金额">
    <button class="btn-remove">&times;</button>
  `;
  row.querySelector('.btn-remove').addEventListener('click', () => {
    row.remove();
  });
  container.appendChild(row);
}

function renderProjectsSettings(projects) {
  const container = document.getElementById('projectsList');
  container.innerHTML = '';
  projects.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'project-item';
    row.innerHTML = `
      <input type="text" class="input-name" value="${p.name}" placeholder="名称">
      <input type="number" class="input-percent" value="${p.percent}" placeholder="%" 
        min="0" max="100">
      <div class="color-swatch" style="background:${p.color}" data-color="${p.color}"></div>
      <button class="btn-remove">&times;</button>
    `;
    row.querySelector('.btn-remove').addEventListener('click', () => {
      row.remove();
      updatePercentHint();
    });
    row.querySelector('.input-percent').addEventListener('input', updatePercentHint);
    row.querySelector('.color-swatch').addEventListener('click', (e) => {
      openColorPicker(e.target);
    });
    container.appendChild(row);
  });
}

function addProjectRow() {
  const container = document.getElementById('projectsList');
  const randomColor = MORANDI_COLORS[Math.floor(Math.random() * MORANDI_COLORS.length)];
  const row = document.createElement('div');
  row.className = 'project-item';
  row.innerHTML = `
    <input type="text" class="input-name" value="" placeholder="名称">
    <input type="number" class="input-percent" value="" placeholder="%" min="0" max="100">
    <div class="color-swatch" style="background:${randomColor}" data-color="${randomColor}"></div>
    <button class="btn-remove">&times;</button>
  `;
  row.querySelector('.btn-remove').addEventListener('click', () => {
    row.remove();
    updatePercentHint();
  });
  row.querySelector('.input-percent').addEventListener('input', updatePercentHint);
  row.querySelector('.color-swatch').addEventListener('click', (e) => {
    openColorPicker(e.target);
  });
  container.appendChild(row);
  updatePercentHint();
}

function updatePercentHint() {
  const inputs = document.querySelectorAll('#projectsList .input-percent');
  let total = 0;
  inputs.forEach(inp => { total += parseInt(inp.value) || 0; });
  const hint = document.getElementById('percentHint');
  hint.textContent = `当前占比总和: ${total}%${total !== 100 ? ' (需要等于100%)' : ' ✓'}`;
  hint.className = total === 100 ? 'percent-hint' : 'percent-hint error';
}
// ===== 颜色选择器 =====

let currentColorTarget = null;

function openColorPicker(swatchEl) {
  currentColorTarget = swatchEl;
  const palette = document.getElementById('colorPalette');
  palette.innerHTML = '';

  MORANDI_COLORS.forEach(color => {
    const btn = document.createElement('div');
    btn.className = 'color-option';
    btn.style.background = color;
    if (swatchEl.dataset.color === color) {
      btn.classList.add('selected');
    }
    btn.addEventListener('click', () => {
      currentColorTarget.style.background = color;
      currentColorTarget.dataset.color = color;
      closeModal('colorPickerModal');
    });
    palette.appendChild(btn);
  });

  openModal('colorPickerModal');
}

// ===== 保存设置 =====

function handleSaveSettings() {
  const totalBudget = parseFloat(document.getElementById('setTotalBudget').value) || 0;
  const plannedSaving = parseFloat(document.getElementById('setPlannedSaving').value) || 0;

  // 解析日期
  const startDateVal = document.getElementById('setStartDate').value;
  const endDateVal = document.getElementById('setEndDate').value;

  if (!startDateVal || !endDateVal) {
    alert('请填写预算周期的起始日和结束日');
    return;
  }

  const startDate = new Date(startDateVal);
  const endDate = new Date(endDateVal);

  if (startDate > endDate) {
    alert('起始日不能晚于结束日');
    return;
  }

  const budgetStartYear = startDate.getFullYear();
  const budgetStartMonth = startDate.getMonth() + 1;
  const budgetStartDay = startDate.getDate();
  const budgetEndYear = endDate.getFullYear();
  const budgetEndMonth = endDate.getMonth() + 1;
  const budgetEndDay = endDate.getDate();

  // 收集固定开支
  const fixedExpenses = [];
  document.querySelectorAll('#fixedExpensesList .fixed-item').forEach(row => {
    const name = row.querySelector('.input-name').value.trim();
    const amount = parseFloat(row.querySelector('.input-amount').value) || 0;
    if (name && amount > 0) {
      fixedExpenses.push({ name, amount });
    }
  });

  // 收集项目
  const projects = [];
  let totalPercent = 0;
  document.querySelectorAll('#projectsList .project-item').forEach(row => {
    const name = row.querySelector('.input-name').value.trim();
    const percent = parseInt(row.querySelector('.input-percent').value) || 0;
    const color = row.querySelector('.color-swatch').dataset.color;
    if (name) {
      projects.push({ name, percent, color });
      totalPercent += percent;
    }
  });

  // 验证
  if (totalBudget <= 0) {
    alert('请输入有效的本月总金额');
    return;
  }

  if (projects.length === 0) {
    alert('请至少添加一个花费项目');
    return;
  }

  if (totalPercent !== 100) {
    alert(`项目占比之和为 ${totalPercent}%，需要等于 100%`);
    return;
  }

  const settings = { totalBudget, plannedSaving, budgetStartYear, budgetStartMonth, budgetStartDay, budgetEndYear, budgetEndMonth, budgetEndDay, fixedExpenses, projects };
  saveSettings(settings);

  // 清理孤立数据：删除已不存在项目的引用
  const daily = loadDailyData();
  const currentProjectNames = new Set(projects.map(p => p.name));

  if (daily.todayOverrides) {
    Object.keys(daily.todayOverrides).forEach(name => {
      if (!currentProjectNames.has(name)) {
        delete daily.todayOverrides[name];
      }
    });
  }

  if (daily.projectAdjustments) {
    Object.keys(daily.projectAdjustments).forEach(name => {
      if (!currentProjectNames.has(name)) {
        delete daily.projectAdjustments[name];
      }
    });
  }

  daily.todayOverrides = null;
  saveDailyData(daily);
  editedProjects.clear();

  closeModal('settingsModal');
  renderAll();
}

// ===== 月底自动结转到存钱罐 =====

function checkMonthEndTransfer() {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  // 如果是本月最后一天，检查是否已结转
  if (today.getDate() === lastDay) {
    const transferKey = `transferred_${getMonthKey()}`;
    if (!Store.get(transferKey)) {
      const remaining = getRemainingDistributable();
      if (remaining > 0) {
        const piggy = loadPiggy();
        piggy.total += remaining;
        piggy.records.push({
          type: 'deposit',
          amount: remaining,
          note: `${getMonthKey()} 月底结余转入`,
          date: today.toLocaleDateString('zh-CN')
        });
        savePiggy(piggy);
        Store.set(transferKey, true);
      }
    }
  }
}

// ===== 每日重置检查 =====

function checkDayReset() {
  const daily = loadDailyData();
  const today = getTodayDate();

  // 如果上次更新不是今天，清除今日覆盖
  if (daily.lastUpdateDate && daily.lastUpdateDate !== today) {
    daily.todayOverrides = null;
    saveDailyData(daily);
  }
}

// ===== 存档子菜单 =====

function toggleArchiveMenu() {
  const menu = document.getElementById('archiveSubMenu');
  menu.classList.toggle('hidden');
}

function closeArchiveMenu() {
  document.getElementById('archiveSubMenu').classList.add('hidden');
}

// 点击子菜单外部关闭
document.addEventListener('click', (e) => {
  const menu = document.getElementById('archiveSubMenu');
  const btn = document.getElementById('btnArchive');
  if (!menu.classList.contains('hidden') &&
      !menu.contains(e.target) &&
      !btn.contains(e.target)) {
    closeArchiveMenu();
  }
});

// ===== 备份导出/导入 =====

function handleExportBackup() {
  const backup = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('settings_') ||
        key.startsWith('daily_') ||
        key.startsWith('transferred_')) {
      backup[key] = localStorage.getItem(key);
    }
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  a.href = url;
  a.download = `预算备份_${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleImportBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const backup = JSON.parse(e.target.result);
      if (confirm('恢复备份将覆盖现有数据，是否继续？')) {
        for (const key in backup) {
          localStorage.setItem(key, backup[key]);
        }
        window.location.reload();
      }
    } catch (err) {
      alert('备份文件格式错误：' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ===== 初始化 =====

function init() {
  // 注册 Service Worker（PWA 离线支持）
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      console.log('Service Worker 注册成功');
      // 定期检测 SW 更新，每小时检查一次，有新版本时 SW 会自动通知页面刷新
      setInterval(() => reg.update(), 60 * 60 * 1000);
    }).catch((err) => {
      console.warn('Service Worker 注册失败:', err);
    });

    // 监听 SW 版本更新消息，收到后强制刷新到新版本
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SKIP_WAITING') {
        window.location.reload();
      }
    });
  }

  // 检查是否有设置，没有则打开设置页
  const key = `settings_${getMonthKey()}`;
  const hasSettings = Store.get(key);

  checkDayReset();
  checkMonthEndTransfer();
  bindEvents();
  renderAppTitle();
  renderAll();

  // 首次使用提示
  if (!hasSettings) {
    setTimeout(() => {
      if (confirm(`欢迎使用${getAppDisplayName()}管理系统！\n是否现在进行月度设置？`)) {
        openSettings();
      }
    }, 500);
  }
}

// 启动
document.addEventListener('DOMContentLoaded', init);
