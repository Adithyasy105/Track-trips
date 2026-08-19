// backend/src/utils/settlementAlgo.js

import {
  resolveExpenseAllocations,
  normalizeParticipants,
} from './splitEngine.js';

/**
 * Convert an expense/payment amount to integer paise.
 *
 * This exists only as a backwards-compatible fallback.
 * New payment records should preferably contain amount_paise.
 */
const toPaise = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.round(number * 100);
};

/**
 * Prefer authoritative amount_paise.
 *
 * Legacy rows that do not have amount_paise fall back to
 * the old decimal `amount` column.
 */
const paymentPaise = (payment) => {
  if (
    Number.isSafeInteger(
      payment?.amount_paise
    )
  ) {
    return payment.amount_paise;
  }

  return toPaise(payment?.amount);
};

/**
 * Remove expenses that cannot safely participate in settlement.
 */
export function filterValidExpenses(
  expenses,
  memberSet
) {
  return (expenses || []).filter(
    (expense) => {
      if (
        !expense ||
        !expense.payer_username ||
        !memberSet.has(
          expense.payer_username
        )
      ) {
        return false;
      }

      const participants =
        normalizeParticipants(
          expense.participants || []
        );

      const explicitParticipants =
        Array.isArray(
          expense.participant_allocations
        )
          ? expense.participant_allocations.map(
              (entry) =>
                entry.username
            )
          : [];

      const allParticipants =
        normalizeParticipants([
          ...participants,
          ...explicitParticipants,
        ]);

      if (!allParticipants.length) {
        return false;
      }

      return allParticipants.every(
        (username) =>
          memberSet.has(username)
      );
    }
  );
}

/**
 * Calculate balances and minimal settlement instructions.
 *
 * Important:
 *
 * Expenses:
 *   payer receives credit
 *   participants receive debt
 *
 * Completed payments:
 *   sender gets credit
 *   receiver's previous credit is reduced
 *
 * Pending / initiated / awaiting payments are NOT included.
 *
 * Therefore an active UPI payment does not change the
 * authoritative settlement until the receiver confirms it.
 */
export function computeSettlements(
  validExpenses,
  memberSet,
  completedPayments = []
) {
  const paidPaise = {};
  const owesPaise = {};

  /*
   * Initialize every member.
   */
  for (const username of memberSet) {
    paidPaise[username] = 0;
    owesPaise[username] = 0;
  }

  /*
   * ---------------------------------------------------------
   * EXPENSES
   * ---------------------------------------------------------
   */
  for (const expense of validExpenses) {
    const payer =
      expense.payer_username;

    if (
      !payer ||
      paidPaise[payer] === undefined
    ) {
      continue;
    }

    const totalPaise =
      toPaise(expense.amount);

    paidPaise[payer] +=
      totalPaise;

    const allocations =
      resolveExpenseAllocations(
        {
          ...expense,
          participants:
            expense.participants || [],
          split_type:
            expense.split_type ||
            'EQUAL',
          split_data:
            expense.split_data || {},
        },
        memberSet
      );

    for (const allocation of allocations) {
      const target =
        allocation.username;

      if (
        owesPaise[target] === undefined
      ) {
        owesPaise[target] = 0;
      }

      owesPaise[target] +=
        Number(
          allocation.amountPaise || 0
        );
    }
  }

  /*
   * ---------------------------------------------------------
   * BASE NET BALANCE
   * ---------------------------------------------------------
   *
   * positive = should receive
   * negative = should pay
   */
  const netPaise = {};

  for (const username of memberSet) {
    netPaise[username] =
      paidPaise[username] -
      owesPaise[username];
  }

  /*
   * ---------------------------------------------------------
   * COMPLETED PAYMENTS
   * ---------------------------------------------------------
   *
   * ONLY completed payments affect settlement.
   */
  for (const payment of completedPayments || []) {
    const from =
      payment?.from_username;

    const to =
      payment?.to_username;

    const amountPaise =
      paymentPaise(payment);

    if (
      from &&
      netPaise[from] !== undefined
    ) {
      netPaise[from] +=
        amountPaise;
    }

    if (
      to &&
      netPaise[to] !== undefined
    ) {
      netPaise[to] -=
        amountPaise;
    }
  }

  /*
   * ---------------------------------------------------------
   * DISPLAY BALANCES
   * ---------------------------------------------------------
   *
   * Keep:
   *
   * net = paid - owes
   *
   * mathematically consistent.
   */
  const balances = {};

  for (const username of memberSet) {
    const completedOutgoingPaise =
      (completedPayments || [])
        .filter(
          (payment) =>
            payment?.from_username ===
            username
        )
        .reduce(
          (sum, payment) =>
            sum +
            paymentPaise(payment),
          0
        );

    const completedIncomingPaise =
      (completedPayments || [])
        .filter(
          (payment) =>
            payment?.to_username ===
            username
        )
        .reduce(
          (sum, payment) =>
            sum +
            paymentPaise(payment),
          0
        );

    const paid =
      paidPaise[username] +
      completedOutgoingPaise;

    const owes =
      owesPaise[username] +
      completedIncomingPaise;

    balances[username] = {
      paid: Number(
        (paid / 100).toFixed(2)
      ),

      owes: Number(
        (owes / 100).toFixed(2)
      ),

      net: Number(
        (
          netPaise[username] / 100
        ).toFixed(2)
      ),
    };
  }

  /*
   * Make sure all settlement mathematics remain valid.
   */
  assertSettlementInvariants(
    balances,
    netPaise
  );

  /*
   * ---------------------------------------------------------
   * CREATE CREDITORS / DEBTORS
   * ---------------------------------------------------------
   *
   * 1 paise is used as the minimum mathematical settlement
   * threshold.
   */
  const THRESHOLD = 1;

  const creditors = [];
  const debtors = [];

  for (const username of memberSet) {
    const net =
      netPaise[username];

    if (net >= THRESHOLD) {
      creditors.push({
        username,
        amountPaise: net,
      });
    }

    if (net <= -THRESHOLD) {
      debtors.push({
        username,
        amountPaise:
          Math.abs(net),
      });
    }
  }

  /*
   * Largest balances first.
   */
  creditors.sort(
    (a, b) =>
      b.amountPaise -
      a.amountPaise
  );

  debtors.sort(
    (a, b) =>
      b.amountPaise -
      a.amountPaise
  );

  /*
   * ---------------------------------------------------------
   * MATCH DEBTORS → CREDITORS
   * ---------------------------------------------------------
   */
  const settlements = [];

  let creditorIndex = 0;
  let debtorIndex = 0;

  while (
    creditorIndex <
      creditors.length &&
    debtorIndex <
      debtors.length
  ) {
    const creditor =
      creditors[creditorIndex];

    const debtor =
      debtors[debtorIndex];

    const settlePaise =
      Math.min(
        creditor.amountPaise,
        debtor.amountPaise
      );

    if (settlePaise >= THRESHOLD) {
      settlements.push({
        from: debtor.username,
        to: creditor.username,

        /*
         * Paise is authoritative.
         */
        amountPaise:
          settlePaise,

        /*
         * Decimal representation is only for
         * frontend/API display.
         */
        amount: Number(
          (settlePaise / 100).toFixed(
            2
          )
        ),
      });
    }

    creditor.amountPaise -=
      settlePaise;

    debtor.amountPaise -=
      settlePaise;

    if (
      creditor.amountPaise <
      THRESHOLD
    ) {
      creditorIndex += 1;
    }

    if (
      debtor.amountPaise <
      THRESHOLD
    ) {
      debtorIndex += 1;
    }
  }

  /*
   * Every settlement must point from a debtor
   * to a creditor.
   */
  for (const settlement of settlements) {
    if (
      !(
        netPaise[
          settlement.from
        ] <= -THRESHOLD &&
        netPaise[
          settlement.to
        ] >= THRESHOLD
      )
    ) {
      throw new Error(
        `Settlement direction invariant violated for ${settlement.from} -> ${settlement.to}`
      );
    }
  }

  return {
    balances,
    settlements,
  };
}

/**
 * Verify all important settlement invariants.
 */
export function assertSettlementInvariants(
  balances,
  netPaise = null,
  tolerancePaise = 1
) {
  const entries =
    Object.entries(
      balances || {}
    );

  /*
   * Total net must equal zero.
   */
  const totalNetPaise =
    entries.reduce(
      (sum, [, balance]) =>
        sum +
        Math.round(
          Number(
            balance?.net || 0
          ) * 100
        ),
      0
    );

  if (
    Math.abs(
      totalNetPaise
    ) > tolerancePaise
  ) {
    throw new Error(
      `Settlement invariant violated: final nets do not sum to zero (${totalNetPaise} paise)`
    );
  }

  /*
   * net must equal paid - owes.
   */
  for (const [
    username,
    balance,
  ] of entries) {
    const paidPaise =
      Math.round(
        Number(
          balance?.paid || 0
        ) * 100
      );

    const owesPaise =
      Math.round(
        Number(
          balance?.owes || 0
        ) * 100
      );

    const netPaiseValue =
      Math.round(
        Number(
          balance?.net || 0
        ) * 100
      );

    if (
      Math.abs(
        netPaiseValue -
          (paidPaise -
            owesPaise)
      ) > tolerancePaise
    ) {
      throw new Error(
        `Settlement invariant violated for ${username}: net must equal paid minus owes`
      );
    }

    /*
     * If raw paise values were supplied,
     * ensure displayed net did not lose precision.
     */
    if (
      netPaise &&
      Math.abs(
        Number(
          netPaise[username] || 0
        ) -
          netPaiseValue
      ) > tolerancePaise
    ) {
      throw new Error(
        `Settlement invariant violated for ${username}: net precision mismatch`
      );
    }
  }
}

/**
 * Build complete settlement snapshot.
 */
export function buildSettlementSnapshot(
  expenses,
  memberSet,
  completedPayments = []
) {
  const validExpenses =
    filterValidExpenses(
      expenses,
      memberSet
    );

  const {
    balances,
    settlements,
  } = computeSettlements(
    validExpenses,
    memberSet,
    completedPayments
  );

  /*
   * Summary amount is a display value.
   * Settlement mathematics above remains paise based.
   */
  const totalExpensesPaise =
    validExpenses.reduce(
      (sum, expense) =>
        sum +
        toPaise(
          expense?.amount
        ),
      0
    );

  return {
    validExpenses,

    balances,

    settlements,

    summary: {
      total_expenses: Number(
        (
          totalExpensesPaise /
          100
        ).toFixed(2)
      ),

      total_expenses_count:
        validExpenses.length,
    },
  };
}