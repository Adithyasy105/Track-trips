const normalizeParticipants = (participants = []) => {
  const seen = new Set();
  const list = [];

  for (const participant of participants || []) {
    if (!participant) continue;
    const username = String(participant).trim();
    if (!username || seen.has(username)) continue;
    seen.add(username);
    list.push(username);
  }

  return list;
};

export const toPaise = (value) => {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.round(Number(value) * 100);
};

export const calculateEqualAllocations = (totalPaise, participants) => {
  const list = normalizeParticipants(participants);
  if (!list.length) return [];

  const base = Math.floor(totalPaise / list.length);
  const remainder = totalPaise % list.length;

  return list.map((username, index) => ({
    username,
    amountPaise: base + (index < remainder ? 1 : 0),
  }));
};

export const calculateExactAllocations = (totalPaise, participants, values = {}) => {
  const list = normalizeParticipants(participants);
  const allocations = [];
  let enteredTotal = 0;

  for (const username of list) {
    const rawValue = Number(values?.[username] ?? values?.amounts?.[username] ?? 0);
    if (!Number.isFinite(rawValue) || rawValue < 0) {
      throw new Error(`Exact amount for ${username} is invalid.`);
    }

    const amountPaise = toPaise(rawValue);
    enteredTotal += amountPaise;
    allocations.push({ username, amountPaise });
  }

  if (enteredTotal !== totalPaise) {
    throw new Error(`Exact amounts must add up to ${totalPaise} paise.`);
  }

  return allocations;
};

export const calculatePercentageAllocations = (totalPaise, participants, values = {}) => {
  const list = normalizeParticipants(participants);
  if (!list.length) return [];

  const totalPercent = list.reduce((sum, username) => {
    const percentage = Number(values?.[username] ?? values?.percentages?.[username] ?? 0);
    if (!Number.isFinite(percentage) || percentage < 0) {
      throw new Error(`Percentage for ${username} is invalid.`);
    }
    return sum + percentage;
  }, 0);

  if (Math.abs(totalPercent - 100) > 0.000001) {
    throw new Error(`Percentages must add up to 100%. Currently ${totalPercent.toFixed(2)}%.`);
  }

  const raw = list.map((username) => {
    const percentage = Number(values?.[username] ?? values?.percentages?.[username] ?? 0);
    const exactPaise = (totalPaise * percentage) / 100;
    return {
      username,
      exactPaise,
      amountPaise: Math.floor(exactPaise),
    };
  });

  const remainder = totalPaise - raw.reduce((sum, entry) => sum + entry.amountPaise, 0);
  const sorted = [...raw].sort((a, b) => (b.exactPaise - b.amountPaise) - (a.exactPaise - a.amountPaise));

  for (let i = 0; i < remainder; i += 1) {
    if (!sorted[i]) break;
    sorted[i].amountPaise += 1;
  }

  return raw.map((entry) => ({
    username: entry.username,
    amountPaise: sorted.find((candidate) => candidate.username === entry.username)?.amountPaise ?? 0,
  }));
};

export const calculateSharesAllocations = (totalPaise, participants, values = {}) => {
  const list = normalizeParticipants(participants);
  if (!list.length) return [];

  const totalShares = list.reduce((sum, username) => {
    const share = Number(values?.[username] ?? values?.shares?.[username] ?? 0);
    if (!Number.isFinite(share) || share < 0) {
      throw new Error(`Share for ${username} is invalid.`);
    }
    return sum + share;
  }, 0);

  if (totalShares <= 0) {
    throw new Error('Add at least one positive share.');
  }

  const raw = list.map((username) => {
    const share = Number(values?.[username] ?? values?.shares?.[username] ?? 0);
    const exactPaise = (totalPaise * share) / totalShares;
    return {
      username,
      exactPaise,
      amountPaise: Math.floor(exactPaise),
    };
  });

  const remainder = totalPaise - raw.reduce((sum, entry) => sum + entry.amountPaise, 0);
  const sorted = [...raw].sort((a, b) => (b.exactPaise - b.amountPaise) - (a.exactPaise - a.amountPaise));

  for (let i = 0; i < remainder; i += 1) {
    if (!sorted[i]) break;
    sorted[i].amountPaise += 1;
  }

  return raw.map((entry) => ({
    username: entry.username,
    amountPaise: sorted.find((candidate) => candidate.username === entry.username)?.amountPaise ?? 0,
  }));
};

export const calculateAdjustmentAllocations = (totalPaise, participants, values = {}) => {
  const list = normalizeParticipants(participants);
  if (!list.length) return [];

  const adjustmentMap = {};
  for (const username of list) {
    const value = Number(values?.[username] ?? values?.adjustments?.[username] ?? 0);
    if (!Number.isFinite(value)) {
      throw new Error(`Adjustment for ${username} is invalid.`);
    }
    adjustmentMap[username] = Math.round(value * 100);
  }

  const positiveAdjusted = list.filter((username) => adjustmentMap[username] > 0);
  const zeroOrNegative = list.filter((username) => adjustmentMap[username] <= 0);

  let remainingPool = totalPaise;
  const allocations = {};

  for (const username of positiveAdjusted) {
    allocations[username] = adjustmentMap[username];
    remainingPool -= adjustmentMap[username];
  }

  for (const username of zeroOrNegative) {
    allocations[username] = 0;
  }

  if (zeroOrNegative.length) {
    const base = Math.floor(remainingPool / zeroOrNegative.length);
    const remainder = remainingPool % zeroOrNegative.length;
    zeroOrNegative.forEach((username, index) => {
      allocations[username] = base + (index < remainder ? 1 : 0);
    });
  }

  const totalAllocated = Object.values(allocations).reduce((sum, value) => sum + value, 0);
  if (totalAllocated !== totalPaise) {
    throw new Error('Adjustment split does not match the total bill.');
  }

  return list.map((username) => ({ username, amountPaise: allocations[username] ?? 0 }));
};

export const calculateItemizedAllocations = (totalPaise, participants, items = []) => {
  const list = normalizeParticipants(participants);
  if (!list.length) return [];

  const allocationsMap = new Map();
  let itemsTotal = 0;

  for (const item of items || []) {
    if (!item || !item.name) continue;
    const assigned = normalizeParticipants(item.participants || []);
    if (!assigned.length) {
      throw new Error(`Item "${item.name}" must be assigned to at least one participant.`);
    }
    const unselected = assigned.filter((username) => !list.includes(username));
    if (unselected.length) {
      throw new Error(`Item "${item.name}" includes participants not selected for this expense: ${unselected.join(', ')}.`);
    }

    const amountPaise = toPaise(item.amount ?? 0);
    itemsTotal += amountPaise;

    const share = Math.floor(amountPaise / assigned.length);
    const remainder = amountPaise % assigned.length;

    assigned.forEach((username, index) => {
      const amount = share + (index < remainder ? 1 : 0);
      allocationsMap.set(username, (allocationsMap.get(username) || 0) + amount);
    });
  }

  if (itemsTotal !== totalPaise) {
    throw new Error(`Itemized amounts must add up to ${totalPaise} paise.`);
  }

  return list.map((username) => ({
    username,
    amountPaise: allocationsMap.get(username) || 0,
  }));
};

export const normalizeSplitData = (splitType, splitData = {}) => {
  const normalized = { ...splitData };
  if (splitType === 'EQUAL') return {};
  if (splitType === 'ITEMIZED') {
    if (!Array.isArray(normalized.items)) {
      return { items: [] };
    }
    return { items: normalized.items };
  }
  return normalized;
};

export const resolveExpenseAllocations = (expense, memberSet = null) => {
  const participantList = normalizeParticipants(expense?.participants || []);
  const explicitAllocations = Array.isArray(expense?.participant_allocations)
    ? expense.participant_allocations.map((entry) => entry.username)
    : [];
  const selected = normalizeParticipants([...participantList, ...explicitAllocations]);

  if (!selected.length) return [];

  const validMemberSet = memberSet ? new Set(memberSet) : new Set(selected);
  const effectiveParticipants = selected.filter((username) => validMemberSet.has(username));
  const totalPaise = toPaise(expense?.amount ?? 0);
  const splitType = String(expense?.split_type || 'EQUAL').toUpperCase();
  const splitData = normalizeSplitData(splitType, expense?.split_data || {});

  switch (splitType) {
    case 'EXACT':
      return calculateExactAllocations(totalPaise, effectiveParticipants, splitData || {});
    case 'PERCENTAGE':
      return calculatePercentageAllocations(totalPaise, effectiveParticipants, splitData || {});
    case 'SHARES':
      return calculateSharesAllocations(totalPaise, effectiveParticipants, splitData || {});
    case 'ADJUSTMENT':
      return calculateAdjustmentAllocations(totalPaise, effectiveParticipants, splitData || {});
    case 'ITEMIZED':
      return calculateItemizedAllocations(totalPaise, effectiveParticipants, splitData?.items || []);
    case 'EQUAL':
    default:
      return calculateEqualAllocations(totalPaise, effectiveParticipants);
  }
};

export const validateExpenseAllocations = (expense) => {
  const totalPaise = toPaise(expense?.amount ?? 0);
  const allocations = resolveExpenseAllocations(expense);
  const totalAllocated = allocations.reduce((sum, entry) => sum + Number(entry.amountPaise || 0), 0);

  return {
    valid: totalAllocated === totalPaise,
    totalPaise,
    totalAllocated,
    allocations,
  };
};

export { normalizeParticipants };
