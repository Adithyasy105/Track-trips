// src/components/trips/AddExpenseModal.js

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";

import { motion, AnimatePresence } from "framer-motion";

import {
  FaTimes,
  FaPercent,
  FaCoins,
  FaSlidersH,
  FaListUl,
  FaCheck,
  FaExclamationTriangle,
  FaEquals,
  FaPiggyBank,
  FaChevronDown,
  FaUserCheck,
  FaUsers,
  FaReceipt,
  FaArrowRight,
  FaPlus,
  FaTrash,
  FaStar,
  FaMoneyBillWave,
  FaWallet,
} from "react-icons/fa";

import toast from "react-hot-toast";

import {
  expensesAPI,
  tripsAPI,
  paymentsAPI,
  aiAPI,
} from "../../services/api";

/* =========================================================
   CONSTANTS
========================================================= */

const splitOptions = [
  {
    id: "EQUAL",
    title: "Equally",
    shortTitle: "Equal",
    description: "Everyone pays the same amount.",
    helper: "Best for dinners, taxis and shared costs.",
    icon: FaEquals,
  },
  {
    id: "EXACT",
    title: "Exact amounts",
    shortTitle: "Exact",
    description: "Enter exactly what each person owes.",
    helper: "Best when everyone ordered different things.",
    icon: FaCoins,
  },
  {
    id: "PERCENTAGE",
    title: "By percentage",
    shortTitle: "%",
    description: "Choose the percentage each person pays.",
    helper: "Percentages must add up to 100%.",
    icon: FaPercent,
  },
  {
    id: "SHARES",
    title: "By shares",
    shortTitle: "Shares",
    description: "Give people relative weights.",
    helper: "Example: one person gets 2 shares, another 1.",
    icon: FaPiggyBank,
  },
  {
    id: "ADJUSTMENT",
    title: "Adjustment",
    shortTitle: "Adjust",
    description: "Add or subtract a fixed amount.",
    helper: "Useful when one person paid extra.",
    icon: FaSlidersH,
  },
  {
    id: "ITEMIZED",
    title: "Itemized",
    shortTitle: "Items",
    description: "Assign individual items to people.",
    helper: "Best for detailed restaurant receipts.",
    icon: FaListUl,
  },
];

const categories = [
  {
    value: "Food",
    label: "Food",
  },
  {
    value: "Transport",
    label: "Transport",
  },
  {
    value: "Accommodation",
    label: "Accommodation",
  },
  {
    value: "Entertainment",
    label: "Entertainment",
  },
  {
    value: "Shopping",
    label: "Shopping",
  },
  {
    value: "Other",
    label: "Other",
  },
];

/* =========================================================
   MONEY HELPERS
========================================================= */

const toPaise = (value) => {
  if (!Number.isFinite(Number(value))) return 0;

  return Math.round(Number(value) * 100);
};

const formatCurrency = (value) => {
  if (!Number.isFinite(Number(value))) {
    return "₹0.00";
  }

  return Number(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const normalizeParticipants = (participants = []) => {
  const seen = new Set();
  const result = [];

  for (const participant of participants || []) {
    if (!participant) continue;

    const username = String(participant).trim();

    if (!username || seen.has(username)) continue;

    seen.add(username);
    result.push(username);
  }

  return result;
};

const getMemberName = (members, username) => {
  const member = members.find(
    (item) => item.username === username
  );

  return member?.full_name || member?.name || username;
};

const getInitial = (name = "") => {
  return String(name).trim().charAt(0).toUpperCase() || "?";
};

/* =========================================================
   SPLIT CALCULATIONS
========================================================= */

const calculateEqualPreview = (amount, participants) => {
  const totalPaise = toPaise(amount);
  const list = normalizeParticipants(participants);

  if (!list.length || totalPaise <= 0) {
    return [];
  }

  const base = Math.floor(totalPaise / list.length);
  const remainder = totalPaise % list.length;

  return list.map((username, index) => ({
    username,
    amountPaise:
      base + (index < remainder ? 1 : 0),
  }));
};

/* ---------------------------------------------------------
   EXACT
--------------------------------------------------------- */

const calculateExactPreview = (
  amount,
  participants,
  values
) => {
  const totalPaise = toPaise(amount);
  const list = normalizeParticipants(participants);

  const entries = list.map((username) => {
    const raw = Number(values?.[username] ?? 0);

    return {
      username,
      amountPaise: Math.max(
        0,
        Math.round(raw * 100)
      ),
    };
  });

  const entered = entries.reduce(
    (sum, item) => sum + item.amountPaise,
    0
  );

  return {
    entries,
    totalPaise,
    enteredPaise: entered,
    remainingPaise: totalPaise - entered,
    valid: entered === totalPaise,
  };
};

/* ---------------------------------------------------------
   PERCENTAGE
--------------------------------------------------------- */

const calculatePercentagePreview = (
  amount,
  participants,
  values
) => {
  const totalPaise = toPaise(amount);
  const list = normalizeParticipants(participants);

  if (!list.length || totalPaise <= 0) {
    return {
      entries: [],
      totalPercent: 0,
      valid: false,
    };
  }

  const entries = list.map((username) => {
    const percent = Number(
      values?.[username] ?? 0
    );

    const exactPaise =
      (totalPaise * percent) / 100;

    return {
      username,
      percent,
      exactPaise,
      amountPaise: Math.floor(exactPaise),
    };
  });

  const totalPercent = entries.reduce(
    (sum, item) => sum + item.percent,
    0
  );

  const baseTotal = entries.reduce(
    (sum, item) => sum + item.amountPaise,
    0
  );

  const remainder = totalPaise - baseTotal;

  /*
    Distribute rounding remainder deterministically
    according to largest fractional remainder.
  */

  const sorted = [...entries].sort(
    (a, b) =>
      b.exactPaise -
      Math.floor(b.exactPaise) -
      (a.exactPaise -
        Math.floor(a.exactPaise))
  );

  for (
    let index = 0;
    index < remainder && sorted.length;
    index += 1
  ) {
    sorted[index % sorted.length].amountPaise += 1;
  }

  const finalEntries = entries.map(
    (entry) => ({
      username: entry.username,
      percent: entry.percent,
      amountPaise:
        sorted.find(
          (item) =>
            item.username === entry.username
        )?.amountPaise || 0,
    })
  );

  return {
    entries: finalEntries,
    totalPercent,
    valid:
      Math.abs(totalPercent - 100) <
      0.000001,
  };
};

/* ---------------------------------------------------------
   SHARES
--------------------------------------------------------- */

const calculateSharesPreview = (
  amount,
  participants,
  values
) => {
  const totalPaise = toPaise(amount);
  const list = normalizeParticipants(participants);

  if (!list.length || totalPaise <= 0) {
    return {
      entries: [],
      valid: false,
    };
  }

  const totalShares = list.reduce(
    (sum, username) =>
      sum +
      Math.max(
        0,
        Number(values?.[username] ?? 0)
      ),
    0
  );

  if (totalShares <= 0) {
    return {
      entries: [],
      valid: false,
    };
  }

  const entries = list.map((username) => {
    const share = Math.max(
      0,
      Number(values?.[username] ?? 0)
    );

    const exactPaise =
      share > 0
        ? (totalPaise * share) /
          totalShares
        : 0;

    return {
      username,
      share,
      exactPaise,
      amountPaise:
        share > 0
          ? Math.floor(exactPaise)
          : 0,
    };
  });

  const baseTotal = entries.reduce(
    (sum, item) => sum + item.amountPaise,
    0
  );

  const remainder =
    totalPaise - baseTotal;

  const sorted = [...entries].sort(
    (a, b) =>
      b.exactPaise -
      Math.floor(b.exactPaise) -
      (a.exactPaise -
        Math.floor(a.exactPaise))
  );

  for (
    let index = 0;
    index < remainder && sorted.length;
    index += 1
  ) {
    sorted[index % sorted.length].amountPaise +=
      1;
  }

  return {
    entries: entries.map((entry) => ({
      username: entry.username,
      share: entry.share,
      amountPaise:
        sorted.find(
          (item) =>
            item.username === entry.username
        )?.amountPaise || 0,
    })),
    valid: true,
  };
};

/* ---------------------------------------------------------
   ADJUSTMENT
--------------------------------------------------------- */

const calculateAdjustmentPreview = (
  amount,
  participants,
  values
) => {
  const totalPaise = toPaise(amount);
  const list = normalizeParticipants(participants);

  if (!list.length || totalPaise <= 0) {
    return {
      entries: [],
      valid: false,
    };
  }

  const adjustments = {};

  for (const username of list) {
    const value = Number(
      values?.[username] ?? 0
    );

    adjustments[username] =
      Number.isFinite(value)
        ? value
        : 0;
  }

  const totalAdjustmentPaise =
    Object.values(adjustments).reduce(
      (sum, value) =>
        sum + Math.round(Number(value) * 100),
      0
    );

  const remainingPool =
    totalPaise - totalAdjustmentPaise;

  const nonAdjusted = list.filter(
    (username) =>
      Number(adjustments[username] || 0) === 0
  );

  /*
    If there is a remaining amount but nobody
    is available to receive the equal remainder,
    the split is invalid.
  */

  if (
    remainingPool !== 0 &&
    nonAdjusted.length === 0
  ) {
    return {
      entries: [],
      valid: false,
    };
  }

  if (remainingPool < 0) {
    return {
      entries: [],
      valid: false,
    };
  }

  const base = nonAdjusted.length
    ? Math.floor(
        remainingPool /
          nonAdjusted.length
      )
    : 0;

  const remainder = nonAdjusted.length
    ? remainingPool %
      nonAdjusted.length
    : 0;

  const entries = list.map((username) => {
    const adjustment =
      Number(adjustments[username] || 0);

    if (adjustment !== 0) {
      return {
        username,
        amountPaise:
          Math.round(adjustment * 100),
      };
    }

    return {
      username,
      amountPaise: 0,
    };
  });

  nonAdjusted.forEach(
    (username, index) => {
      const entry = entries.find(
        (item) =>
          item.username === username
      );

      if (!entry) return;

      entry.amountPaise =
        base +
        (index < remainder ? 1 : 0);
    }
  );

  return {
    entries,
    valid:
      entries.reduce(
        (sum, item) =>
          sum + item.amountPaise,
        0
      ) === totalPaise,
  };
};

/* ---------------------------------------------------------
   ITEMIZED
--------------------------------------------------------- */

const calculateItemizedPreview = (
  amount,
  participants,
  items
) => {
  const totalPaise = toPaise(amount);
  const list = normalizeParticipants(participants);

  const itemList = Array.isArray(items)
    ? items
    : [];

  const resolved = new Map();

  let itemTotal = 0;

  itemList.forEach((item) => {
    if (!item || !item.name?.trim()) {
      return;
    }

    const assigned =
      normalizeParticipants(
        item.participants || []
      );

    if (!assigned.length) return;

    const thisAmount = toPaise(
      item.amount || 0
    );

    if (thisAmount <= 0) return;

    itemTotal += thisAmount;

    const base = Math.floor(
      thisAmount / assigned.length
    );

    const remainder =
      thisAmount % assigned.length;

    assigned.forEach(
      (username, index) => {
        const value =
          base +
          (index < remainder ? 1 : 0);

        resolved.set(
          username,
          (resolved.get(username) || 0) +
            value
        );
      }
    );
  });

  const entries = list.map(
    (username) => ({
      username,
      amountPaise:
        resolved.get(username) || 0,
    })
  );

  return {
    entries,
    totalPaise: itemTotal,
    valid:
      itemTotal === totalPaise,
  };
};

/* =========================================================
   PREVIEW RESOLVER
========================================================= */

const resolvePreview = ({
  amount,
  participants,
  splitType,
  values,
  items,
}) => {
  const cleaned =
    normalizeParticipants(participants);

  if (
    !cleaned.length ||
    !Number(amount) ||
    Number(amount) <= 0
  ) {
    return {
      entries: [],
      valid: false,
      status: "warning",
      message:
        "Select people and enter an amount.",
    };
  }

  if (splitType === "EQUAL") {
    const entries =
      calculateEqualPreview(
        amount,
        cleaned
      );

    return {
      entries,
      valid: entries.length > 0,
      status: "valid",
      message:
        "The bill is split equally.",
    };
  }

  if (splitType === "EXACT") {
    const result =
      calculateExactPreview(
        amount,
        cleaned,
        values
      );

    const difference =
      result.remainingPaise;

    return {
      entries: result.entries,
      valid: result.valid,
      status: result.valid
        ? "valid"
        : "warning",
      message: result.valid
        ? "Amounts match the bill."
        : difference > 0
        ? `${formatCurrency(
            difference / 100
          )} remaining`
        : `${formatCurrency(
            Math.abs(difference) / 100
          )} over`,
    };
  }

  if (splitType === "PERCENTAGE") {
    const result =
      calculatePercentagePreview(
        amount,
        cleaned,
        values
      );

    const remaining =
      100 - result.totalPercent;

    return {
      entries: result.entries,
      valid: result.valid,
      status: result.valid
        ? "valid"
        : "warning",
      message: result.valid
        ? "Percentages add up to 100%."
        : remaining > 0
        ? `${remaining.toFixed(
            1
          )}% remaining`
        : `${Math.abs(
            remaining
          ).toFixed(1)}% over`,
    };
  }

  if (splitType === "SHARES") {
    const result =
      calculateSharesPreview(
        amount,
        cleaned,
        values
      );

    return {
      entries: result.entries,
      valid: result.valid,
      status: result.valid
        ? "valid"
        : "warning",
      message: result.valid
        ? "Shares are valid."
        : "Give at least one person a share.",
    };
  }

  if (splitType === "ADJUSTMENT") {
    const result =
      calculateAdjustmentPreview(
        amount,
        cleaned,
        values
      );

    return {
      entries: result.entries,
      valid: result.valid,
      status: result.valid
        ? "valid"
        : "warning",
      message: result.valid
        ? "Adjustment split is balanced."
        : "Adjustments do not match the bill.",
    };
  }

  if (splitType === "ITEMIZED") {
    const result =
      calculateItemizedPreview(
        amount,
        cleaned,
        items
      );

    const difference =
      toPaise(amount) -
      result.totalPaise;

    return {
      entries: result.entries,
      valid: result.valid,
      status: result.valid
        ? "valid"
        : "warning",
      message: result.valid
        ? "All items match the bill."
        : difference > 0
        ? `${formatCurrency(
            difference / 100
          )} remaining`
        : `${formatCurrency(
            Math.abs(difference) / 100
          )} over`,
    };
  }

  return {
    entries: [],
    valid: false,
    status: "warning",
    message: "Select a split method.",
  };
};

/* =========================================================
   SMALL UI COMPONENTS
========================================================= */

const Avatar = ({
  name,
  selected = false,
}) => (
  <div
    className={`
      flex h-10 w-10 shrink-0 items-center
      justify-center rounded-full
      text-sm font-bold
      transition-all
      ${
        selected
          ? "bg-primary-600 text-white shadow-md shadow-primary-500/20"
          : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200"
      }
    `}
  >
    {getInitial(name)}
  </div>
);

const SectionTitle = ({
  icon: Icon,
  title,
  description,
}) => (
  <div className="mb-4 flex items-start gap-3">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
      <Icon className="h-4 w-4" />
    </div>

    <div>
      <h3 className="text-sm font-bold text-gray-900 dark:text-white">
        {title}
      </h3>

      {description && (
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
    </div>
  </div>
);

/* =========================================================
   MAIN COMPONENT
========================================================= */

export const AddExpenseModal = ({
  isOpen,
  onClose,
  onSuccess,
  tripId,
  members: initialMembers,
}) => {
  const [members, setMembers] =
    useState(initialMembers || []);

  const [loading, setLoading] =
    useState(false);

  const [amount, setAmount] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [category, setCategory] =
    useState("");

  const [payerUsername, setPayerUsername] =
    useState("");

  const [participants, setParticipants] =
    useState([]);

  const [splitType, setSplitType] =
    useState("EQUAL");

  const [splitValues, setSplitValues] =
    useState({});

  const [items, setItems] = useState([
    {
      id: Date.now(),
      name: "",
      amount: "",
      participants: [],
    },
  ]);

  const [aiCategory, setAiCategory] =
    useState(null);

  const [aiSuggesting, setAiSuggesting] =
    useState(false);

  const [showAllMembers, setShowAllMembers] =
    useState(false);

  const [isSplitMethodOpen, setIsSplitMethodOpen] =
    useState(false);

  const descriptionTimer =
    useRef(null);

  /* -------------------------------------------------------
     PREVIEW
  ------------------------------------------------------- */

  const validPreview = useMemo(
    () =>
      resolvePreview({
        amount,
        participants,
        splitType,
        values: splitValues,
        items,
      }),
    [
      amount,
      participants,
      splitType,
      splitValues,
      items,
    ]
  );

  const previewRows =
    validPreview.entries || [];

  const totalPreviewPaise =
    previewRows.reduce(
      (sum, item) =>
        sum + (item.amountPaise || 0),
      0
    );

  /* -------------------------------------------------------
     LOAD MEMBERS
  ------------------------------------------------------- */

  const loadMembers =
    useCallback(async () => {
      try {
        const response =
          await tripsAPI.getMembers(tripId);

        const tripMembers =
          response.data || [];

        setMembers(tripMembers);

        if (tripMembers.length) {
          setPayerUsername(
            (current) =>
              current ||
              tripMembers[0].username
          );

          setParticipants((current) => {
            if (current.length) {
              return current;
            }

            return tripMembers.map(
              (member) =>
                member.username
            );
          });
        }
      } catch (error) {
        console.error(
          "Failed to load members",
          error
        );

        toast.error(
          "Could not load trip members."
        );
      }
    }, [tripId]);

  useEffect(() => {
    if (!isOpen) return;

    if (
      !initialMembers ||
      initialMembers.length === 0
    ) {
      loadMembers();
      return;
    }

    setMembers(initialMembers);

    setPayerUsername((current) =>
      current ||
      initialMembers[0]?.username ||
      ""
    );

    setParticipants((current) =>
      current.length
        ? current
        : initialMembers.map(
            (member) =>
              member.username
          )
    );
  }, [
    isOpen,
    initialMembers,
    loadMembers,
  ]);

  useEffect(() => {
    if (isOpen) {
      window.dispatchEvent(
        new CustomEvent("expense-modal-open")
      );
      
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
      
      return () => {
        document.body.style.overflow = "";
      };
    }

    // Ensure body scroll is restored when modal closes
    document.body.style.overflow = "";

    // Dispatch close event with a small delay to ensure proper timing
    const timeoutId = setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("expense-modal-closed")
      );
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [isOpen]);

  /* -------------------------------------------------------
     CLEANUP ON UNMOUNT
  ------------------------------------------------------- */

  useEffect(() => {
    return () => {
      // Guarantee body scroll is restored on unmount
      document.body.style.overflow = "";
      window.dispatchEvent(
        new CustomEvent("expense-modal-closed")
      );
    };
  }, []);

  /* -------------------------------------------------------
     SYNC SPLIT VALUES
  ------------------------------------------------------- */

  useEffect(() => {
    setSplitValues((previous) => {
      const next = {
        ...previous,
      };

      for (const username of participants) {
        if (
          next[username] === undefined
        ) {
          next[username] =
            splitType === "EXACT"
              ? ""
              : 0;
        }
      }

      Object.keys(next).forEach(
        (username) => {
          if (
            !participants.includes(
              username
            )
          ) {
            delete next[username];
          }
        }
      );

      return next;
    });
  }, [
    participants,
    splitType,
  ]);

  /* -------------------------------------------------------
     PARTICIPANTS
  ------------------------------------------------------- */

  const toggleParticipant = (
    username
  ) => {
    setParticipants((previous) => {
      if (
        previous.includes(username)
      ) {
        return previous.filter(
          (value) =>
            value !== username
        );
      }

      return [
        ...previous,
        username,
      ];
    });
  };

  const selectAllParticipants =
    () => {
      setParticipants(
        members.map(
          (member) =>
            member.username
        )
      );
    };

  const clearAllParticipants =
    () => {
      setParticipants([]);
    };

  /* -------------------------------------------------------
     SPLIT VALUE
  ------------------------------------------------------- */

  const updateSplitValue = (
    username,
    value
  ) => {
    setSplitValues((previous) => ({
      ...previous,
      [username]: value,
    }));
  };

  /* -------------------------------------------------------
     ITEMS
  ------------------------------------------------------- */

  const addItem = () => {
    setItems((previous) => [
      ...previous,
      {
        id:
          Date.now() +
          Math.random(),
        name: "",
        amount: "",
        participants: [],
      },
    ]);
  };

  const removeItem = (id) => {
    setItems((previous) =>
      previous.filter(
        (item) =>
          item.id !== id
      )
    );
  };

  const updateItem = (
    id,
    field,
    value
  ) => {
    setItems((previous) =>
      previous.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  };

  const toggleItemParticipant = (
    id,
    username
  ) => {
    setItems((previous) =>
      previous.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const current =
          item.participants || [];

        const next =
          current.includes(username)
            ? current.filter(
                (value) =>
                  value !== username
              )
            : [
                ...current,
                username,
              ];

        return {
          ...item,
          participants: next,
        };
      })
    );
  };

  /* -------------------------------------------------------
     AI CATEGORY
  ------------------------------------------------------- */

  const handleDescriptionChange = (
    value
  ) => {
    setDescription(value);
    setAiCategory(null);

    if (descriptionTimer.current) {
      clearTimeout(
        descriptionTimer.current
      );
    }

    if (
      !value ||
      value.trim().length < 4
    ) {
      return;
    }

    descriptionTimer.current =
      setTimeout(async () => {
        setAiSuggesting(true);

        try {
          const response =
            await aiAPI.suggestCategory(
              value
            );

          if (
            response.data
              ?.ai_suggested &&
            response.data?.category
          ) {
            setAiCategory(
              response.data.category
            );
          }
        } catch {
          // AI category suggestion is optional.
        } finally {
          setAiSuggesting(false);
        }
      }, 700);
  };

  const acceptAiCategory = () => {
    if (!aiCategory) return;

    setCategory(aiCategory);
    setAiCategory(null);
  };

  /* -------------------------------------------------------
     RESET
  ------------------------------------------------------- */

  const resetForm = () => {
    setAmount("");
    setDescription("");
    setCategory("");

    setPayerUsername(
      members[0]?.username || ""
    );

    setParticipants(
      members.map(
        (member) =>
          member.username
      )
    );

    setSplitType("EQUAL");
    setSplitValues({});
    setIsSplitMethodOpen(false);

    setItems([
      {
        id: Date.now(),
        name: "",
        amount: "",
        participants: [],
      },
    ]);

    setAiCategory(null);
    setAiSuggesting(false);
  };

  /* -------------------------------------------------------
     SUBMIT
  ------------------------------------------------------- */

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    if (
      !amount ||
      Number(amount) <= 0
    ) {
      toast.error(
        "Enter a valid expense amount."
      );
      return;
    }

    if (!participants.length) {
      toast.error(
        "Select at least one person."
      );
      return;
    }

    if (!payerUsername) {
      toast.error(
        "Choose who paid."
      );
      return;
    }

    if (!validPreview.valid) {
      toast.error(
        validPreview.message ||
          "Fix the split before continuing."
      );
      return;
    }

    setLoading(true);

    try {
      const payload = {
        trip_id: tripId,
        amount: Number(amount),
        description:
          description || undefined,
        category:
          category || undefined,
        payer_username:
          payerUsername,
        participants,
        split_type: splitType,

        split_data: (() => {
          if (
            splitType === "EXACT" ||
            splitType ===
              "PERCENTAGE" ||
            splitType === "SHARES" ||
            splitType === "ADJUSTMENT"
          ) {
            return Object.fromEntries(
              participants.map(
                (username) => [
                  username,
                  Number(
                    splitValues[
                      username
                    ] || 0
                  ),
                ]
              )
            );
          }

          if (
            splitType ===
            "ITEMIZED"
          ) {
            return {
              items: items
                .filter(
                  (item) =>
                    item.name &&
                    item.amount
                )
                .map((item) => ({
                  ...item,
                  amount: Number(
                    item.amount
                  ),
                  participants:
                    item.participants,
                })),
            };
          }

          return {};
        })(),
      };

      await expensesAPI.add(
        payload
      );

      toast.success(
        "Expense added successfully!"
      );

      resetForm();

      onSuccess();

      try {
        await paymentsAPI.reset(
          tripId,
          {
            mode: "soft",
          }
        );
      } catch (resetError) {
        console.error(
          "Failed to sync payments",
          resetError
        );
      }
    } catch (error) {
      toast.error(
        error.response?.data
          ?.error ||
          "Failed to add expense."
      );
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------------------------------------
     CLOSE
  ------------------------------------------------------- */

  const handleClose = () => {
    if (loading) return;

    setIsSplitMethodOpen(false);
    
    // Explicitly dispatch close event before closing
    window.dispatchEvent(
      new CustomEvent("expense-modal-closed")
    );
    
    onClose();
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div
          onClick={handleClose}
          className="
            fixed inset-0 z-50
            flex items-end justify-center
            bg-slate-950/30
            backdrop-blur-[2px]
            sm:items-center
            sm:p-4
          "
          role="presentation"
        >
          <motion.div
            onClick={(e) =>
              e.stopPropagation()
            }
            initial={{
              opacity: 0,
              y: 30,
              scale: 0.98,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: 30,
              scale: 0.98,
            }}
            transition={{
              duration: 0.2,
            }}
            className="
              relative
              flex
              max-h-[96vh]
              w-full
              flex-col
              overflow-hidden
              rounded-t-3xl
              bg-white
              shadow-2xl
              dark:bg-gray-950
              sm:max-w-6xl
              sm:rounded-3xl
            "
          >
            {/* =================================================
                HEADER
            ================================================= */}

            <div
              className="
                flex
                shrink-0
                items-center
                justify-between
                border-b
                border-gray-200
                bg-white
                px-5
                py-4
                dark:border-gray-800
                dark:bg-gray-950
                sm:px-7
              "
            >
              <div className="flex items-center gap-3">
                <div
                  className="
                    flex
                    h-11
                    w-11
                    items-center
                    justify-center
                    rounded-2xl
                    bg-primary-600
                    text-white
                    shadow-lg
                    shadow-primary-500/20
                  "
                >
                  <FaReceipt />
                </div>

                <div>
                  <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white sm:text-xl">
                    Add expense
                  </h2>

                  <p className="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
                    Record a shared expense
                    and split it fairly.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  text-gray-500
                  transition
                  hover:bg-gray-100
                  hover:text-gray-900
                  disabled:opacity-50
                  dark:hover:bg-gray-800
                  dark:hover:text-white
                "
              >
                <FaTimes />
              </button>
            </div>

            {/* =================================================
                BODY
            ================================================= */}

            <div
              className="
                min-h-0
                flex-1
                overflow-y-auto
                bg-gray-50/70
                dark:bg-gray-900/50
              "
            >
              <div
                className="
                  grid
                  gap-5
                  p-4
                  sm:p-6
                  lg:grid-cols-[minmax(0,1fr)_350px]
                    lg:p-7
                "
              >
                {/* =============================================
                    LEFT SIDE
                ============================================= */}

                <form
                  onSubmit={handleSubmit}
                  className="space-y-5"
                >
                  {/* ---------------------------------------------
                      BASIC DETAILS
                  --------------------------------------------- */}

                  <section
                    className="
                      rounded-2xl
                      border
                      border-gray-200
                      bg-white
                      p-5
                      shadow-sm
                      dark:border-gray-800
                      dark:bg-gray-950
                    "
                  >
                    <SectionTitle
                      icon={FaMoneyBillWave}
                      title="Expense details"
                      description="Tell us what you spent money on."
                    />

                    <div className="space-y-4">
                      {/* Description */}

                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Description
                        </label>

                        <div className="relative">
                          <input
                            type="text"
                            value={
                              description
                            }
                            onChange={(event) =>
                              handleDescriptionChange(
                                event.target
                                  .value
                              )
                            }
                            className="
                              w-full
                              rounded-xl
                              border
                              border-gray-200
                              bg-gray-50
                              px-4
                              py-3
                              text-sm
                              text-gray-900
                              outline-none
                              transition
                              placeholder:text-gray-400
                              focus:border-primary-500
                              focus:bg-white
                              focus:ring-4
                              focus:ring-primary-500/10
                              dark:border-gray-700
                              dark:bg-gray-900
                              dark:text-white
                              dark:focus:bg-gray-900
                            "
                            placeholder="e.g. Dinner at Empire"
                          />
                        </div>

                        {aiSuggesting && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                            <FaStar className="text-primary-500" />
                            AI is suggesting a
                            category...
                          </div>
                        )}

                        {aiCategory &&
                          !aiSuggesting && (
                            <button
                              type="button"
                              onClick={
                                acceptAiCategory
                              }
                              className="
                                mt-2
                                inline-flex
                                items-center
                                gap-2
                                rounded-lg
                                bg-primary-50
                                px-3
                                py-2
                                text-xs
                                font-semibold
                                text-primary-700
                                transition
                                hover:bg-primary-100
                                dark:bg-primary-900/30
                                dark:text-primary-300
                              "
                            >
                              <FaStar />
                              Use AI category:
                              <span>
                                {
                                  aiCategory
                                }
                              </span>
                            </button>
                          )}
                      </div>

                      {/* Amount + Category */}

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Amount
                          </label>

                          <div className="relative">
                            <span
                              className="
                                pointer-events-none
                                absolute
                                left-4
                                top-1/2
                                -translate-y-1/2
                                text-sm
                                font-semibold
                                text-gray-400
                              "
                            >
                              ₹
                            </span>

                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={amount}
                              onChange={(
                                event
                              ) =>
                                setAmount(
                                  event
                                    .target
                                    .value
                                )
                              }
                              className="
                                w-full
                                rounded-xl
                                border
                                border-gray-200
                                bg-gray-50
                                py-3
                                pl-9
                                pr-4
                                text-base
                                font-semibold
                                text-gray-900
                                outline-none
                                transition
                                focus:border-primary-500
                                focus:bg-white
                                focus:ring-4
                                focus:ring-primary-500/10
                                dark:border-gray-700
                                dark:bg-gray-900
                                dark:text-white
                              "
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Category
                          </label>

                          <div className="relative">
                            <select
                              value={
                                category
                              }
                              onChange={(
                                event
                              ) =>
                                setCategory(
                                  event
                                    .target
                                    .value
                                )
                              }
                              className="
                                w-full
                                appearance-none
                                rounded-xl
                                border
                                border-gray-200
                                bg-gray-50
                                px-4
                                py-3
                                pr-10
                                text-sm
                                text-gray-900
                                outline-none
                                transition
                                focus:border-primary-500
                                focus:bg-white
                                focus:ring-4
                                focus:ring-primary-500/10
                                dark:border-gray-700
                                dark:bg-gray-900
                                dark:text-white
                              "
                            >
                              <option value="">
                                Select category
                              </option>

                              {categories.map(
                                (item) => (
                                  <option
                                    key={
                                      item.value
                                    }
                                    value={
                                      item.value
                                    }
                                  >
                                    {
                                      item.label
                                    }
                                  </option>
                                )
                              )}
                            </select>

                            <FaChevronDown
                              className="
                                pointer-events-none
                                absolute
                                right-4
                                top-1/2
                                -translate-y-1/2
                                text-xs
                                text-gray-400
                              "
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* ---------------------------------------------
                      PAYER
                  --------------------------------------------- */}

                  <section
                    className="
                      rounded-2xl
                      border
                      border-gray-200
                      bg-white
                      p-5
                      shadow-sm
                      dark:border-gray-800
                      dark:bg-gray-950
                    "
                  >
                    <SectionTitle
                      icon={FaWallet}
                      title="Who paid?"
                      description="Choose the person who covered the bill."
                    />

                    <div className="grid gap-2 sm:grid-cols-2">
                      {members.map(
                        (member) => {
                          const username =
                            member.username;

                          const selected =
                            payerUsername ===
                            username;

                          const name =
                            member.full_name ||
                            member.name ||
                            username;

                          return (
                            <button
                              type="button"
                              key={
                                username
                              }
                              onClick={() =>
                                setPayerUsername(
                                  username
                                )
                              }
                              className={`
                                flex
                                items-center
                                gap-3
                                rounded-xl
                                border
                                p-3
                                text-left
                                transition-all
                                ${
                                  selected
                                    ? "border-primary-500 bg-primary-50 shadow-sm dark:border-primary-500 dark:bg-primary-900/20"
                                    : "border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                                }
                              `}
                            >
                              <Avatar
                                name={name}
                                selected={
                                  selected
                                }
                              />

                              <div className="min-w-0 flex-1">
                                <p
                                  className={`
                                    truncate
                                    text-sm
                                    font-semibold
                                    ${
                                      selected
                                        ? "text-primary-700 dark:text-primary-300"
                                        : "text-gray-800 dark:text-gray-200"
                                    }
                                  `}
                                >
                                  {name}
                                </p>

                                <p className="truncate text-xs text-gray-500">
                                  {
                                    username
                                  }
                                </p>
                              </div>

                              {selected && (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-white">
                                  <FaCheck className="text-[10px]" />
                                </div>
                              )}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </section>

                  {/* ---------------------------------------------
                      PARTICIPANTS
                  --------------------------------------------- */}

                  <section
                    className="
                      rounded-2xl
                      border
                      border-gray-200
                      bg-white
                      p-5
                      shadow-sm
                      dark:border-gray-800
                      dark:bg-gray-950
                    "
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <SectionTitle
                        icon={FaUsers}
                        title="Who is sharing this expense?"
                        description="Only selected people will owe money."
                      />

                      <span
                        className="
                          shrink-0
                          rounded-full
                          bg-primary-50
                          px-3
                          py-1
                          text-xs
                          font-bold
                          text-primary-700
                          dark:bg-primary-900/30
                          dark:text-primary-300
                        "
                      >
                        {
                          participants.length
                        }{" "}
                        selected
                      </span>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={
                          selectAllParticipants
                        }
                        className="
                          rounded-lg
                          bg-gray-100
                          px-3
                          py-1.5
                          text-xs
                          font-semibold
                          text-gray-700
                          transition
                          hover:bg-gray-200
                          dark:bg-gray-800
                          dark:text-gray-200
                          dark:hover:bg-gray-700
                        "
                      >
                        Select all
                      </button>

                      <button
                        type="button"
                        onClick={
                          clearAllParticipants
                        }
                        className="
                          rounded-lg
                          px-3
                          py-1.5
                          text-xs
                          font-semibold
                          text-gray-500
                          transition
                          hover:bg-red-50
                          hover:text-red-600
                          dark:hover:bg-red-900/20
                        "
                      >
                        Clear
                      </button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {(showAllMembers
                        ? members
                        : members.slice(
                            0,
                            6
                          )
                      ).map((member) => {
                        const username =
                          member.username;

                        const name =
                          member.full_name ||
                          member.name ||
                          username;

                        const selected =
                          participants.includes(
                            username
                          );

                        return (
                          <button
                            type="button"
                            key={
                              username
                            }
                            onClick={() =>
                              toggleParticipant(
                                username
                              )
                            }
                            className={`
                              flex
                              items-center
                              gap-3
                              rounded-xl
                              border
                              p-2.5
                              text-left
                              transition
                              ${
                                selected
                                  ? "border-primary-500 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/20"
                                  : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-950"
                              }
                            `}
                          >
                            <Avatar
                              name={name}
                              selected={
                                selected
                              }
                            />

                            <span
                              className={`
                                min-w-0
                                flex-1
                                truncate
                                text-sm
                                font-medium
                                ${
                                  selected
                                    ? "text-primary-700 dark:text-primary-300"
                                    : "text-gray-700 dark:text-gray-300"
                                }
                              `}
                            >
                              {name}
                            </span>

                            <div
                              className={`
                                flex
                                h-5
                                w-5
                                items-center
                                justify-center
                                rounded-full
                                border
                                ${
                                  selected
                                    ? "border-primary-600 bg-primary-600 text-white"
                                    : "border-gray-300 dark:border-gray-600"
                                }
                              `}
                            >
                              {selected && (
                                <FaCheck className="text-[9px]" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {members.length >
                      6 && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowAllMembers(
                            (value) =>
                              !value
                          )
                        }
                        className="
                          mt-3
                          flex
                          w-full
                          items-center
                          justify-center
                          gap-2
                          rounded-xl
                          border
                          border-dashed
                          border-gray-300
                          py-2.5
                          text-xs
                          font-semibold
                          text-gray-500
                          transition
                          hover:border-primary-400
                          hover:text-primary-600
                          dark:border-gray-700
                        "
                      >
                        {showAllMembers
                          ? "Show fewer"
                          : `Show all ${members.length} members`}
                        <FaChevronDown
                          className={`transition ${
                            showAllMembers
                              ? "rotate-180"
                              : ""
                          }`}
                        />
                      </button>
                    )}
                  </section>

                  {/* ---------------------------------------------
                      SPLIT METHOD
                  --------------------------------------------- */}

                  <section
                    className="
                      rounded-2xl
                      border
                      border-gray-200
                      bg-white
                      p-5
                      shadow-sm
                      dark:border-gray-800
                      dark:bg-gray-950
                    "
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <SectionTitle
                        icon={FaReceipt}
                        title="How should this be split?"
                        description="Choose the method that best matches the expense."
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setIsSplitMethodOpen(
                            (value) => !value
                          )
                        }
                        className="
                          inline-flex
                          items-center
                          gap-2
                          rounded-xl
                          border
                          border-gray-200
                          bg-gray-50
                          px-3
                          py-2
                          text-[11px]
                          font-semibold
                          text-gray-600
                          transition
                          hover:border-primary-200
                          hover:bg-primary-50
                          hover:text-primary-700
                          dark:border-gray-700
                          dark:bg-gray-900
                          dark:text-gray-200
                          dark:hover:border-primary-900
                          dark:hover:bg-primary-950/30
                        "
                      >
                        {splitOptions.find(
                          (option) =>
                            option.id ===
                            splitType
                        )?.shortTitle || "Equal"}
                        <FaChevronDown
                          className={`
                            h-2.5 w-2.5
                            transition-transform
                            duration-200
                            ${
                              isSplitMethodOpen
                                ? "rotate-180"
                                : ""
                            }
                          `}
                        />
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {isSplitMethodOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {splitOptions.map((option) => {
                              const Icon = option.icon;
                              const selected =
                                splitType === option.id;

                              return (
                                <button
                                  type="button"
                                  key={option.id}
                                  onClick={() => {
                                    setSplitType(option.id);
                                    setIsSplitMethodOpen(false);
                                  }}
                                  className={`
                                    group
                                    relative
                                    rounded-2xl
                                    border
                                    p-3
                                    text-left
                                    transition-all
                                    ${
                                      selected
                                        ? "border-primary-500 bg-primary-50 shadow-sm dark:border-primary-500 dark:bg-primary-900/20"
                                        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700"
                                    }
                                  `}
                                >
                                  {selected && (
                                    <div
                                      className="
                                        absolute
                                        right-2.5
                                        top-2.5
                                        flex
                                        h-5
                                        w-5
                                        items-center
                                        justify-center
                                        rounded-full
                                        bg-primary-600
                                        text-white
                                      "
                                    >
                                      <FaCheck className="text-[9px]" />
                                    </div>
                                  )}

                                  <div
                                    className={`
                                      mb-2.5
                                      flex
                                      h-9
                                      w-9
                                      items-center
                                      justify-center
                                      rounded-xl
                                      ${
                                        selected
                                          ? "bg-primary-600 text-white"
                                          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300"
                                      }
                                    `}
                                  >
                                    <Icon className="h-3.5 w-3.5" />
                                  </div>

                                  <h4
                                    className={`
                                      text-sm
                                      font-bold
                                      ${
                                        selected
                                          ? "text-primary-800 dark:text-primary-200"
                                          : "text-gray-900 dark:text-white"
                                      }
                                    `}
                                  >
                                    {option.title}
                                  </h4>

                                  <p className="mt-1 text-[11px] leading-4 text-gray-500 dark:text-gray-400">
                                    {option.helper}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>

                  {/* ---------------------------------------------
                      SPLIT CONFIGURATION
                  --------------------------------------------- */}

                  <AnimatePresence mode="wait">
                    <motion.section
                      key={splitType}
                      initial={{
                        opacity: 0,
                        y: 8,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      exit={{
                        opacity: 0,
                        y: -8,
                      }}
                      className="
                        rounded-2xl
                        border
                        border-gray-200
                        bg-white
                        p-5
                        shadow-sm
                        dark:border-gray-800
                        dark:bg-gray-950
                      "
                    >
                      {/* EQUAL */}

                      {splitType ===
                        "EQUAL" && (
                        <div
                          className="
                            rounded-2xl
                            border
                            border-primary-100
                            bg-primary-50
                            p-4
                            dark:border-primary-900
                            dark:bg-primary-900/20
                          "
                        >
                          <div className="flex gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white">
                              <FaEquals />
                            </div>

                            <div>
                              <h4 className="text-sm font-bold text-primary-800 dark:text-primary-200">
                                Equal split
                              </h4>

                              <p className="mt-1 text-xs leading-5 text-primary-700/80 dark:text-primary-300/80">
                                The total is divided
                                equally between all
                                selected people. Any
                                one-paise rounding
                                remainder is distributed
                                automatically.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* EXACT */}

                      {splitType ===
                        "EXACT" && (
                        <div>
                          <div className="mb-4">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                              Enter each person's
                              amount
                            </h4>

                            <p className="mt-1 text-xs text-gray-500">
                              The total of all amounts
                              must exactly equal the
                              expense.
                            </p>
                          </div>

                          <div className="space-y-2">
                            {participants.map(
                              (username) => (
                                <div
                                  key={
                                    username
                                  }
                                  className="
                                    flex
                                    items-center
                                    gap-3
                                    rounded-xl
                                    border
                                    border-gray-200
                                    bg-gray-50
                                    p-3
                                    dark:border-gray-800
                                    dark:bg-gray-900
                                  "
                                >
                                  <Avatar
                                    name={getMemberName(
                                      members,
                                      username
                                    )}
                                  />

                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">
                                      {getMemberName(
                                        members,
                                        username
                                      )}
                                    </p>
                                  </div>

                                  <div className="relative w-32">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                                      ₹
                                    </span>

                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={
                                        splitValues[
                                          username
                                        ] ??
                                        ""
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        updateSplitValue(
                                          username,
                                          event
                                            .target
                                            .value
                                        )
                                      }
                                      className="
                                        w-full
                                        rounded-xl
                                        border
                                        border-gray-200
                                        bg-white
                                        py-2.5
                                        pl-7
                                        pr-3
                                        text-right
                                        text-sm
                                        font-semibold
                                        outline-none
                                        focus:border-primary-500
                                        focus:ring-4
                                        focus:ring-primary-500/10
                                        dark:border-gray-700
                                        dark:bg-gray-950
                                        dark:text-white
                                      "
                                      placeholder="0.00"
                                    />
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* PERCENTAGE */}

                      {splitType ===
                        "PERCENTAGE" && (
                        <div>
                          <div className="mb-4 flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                Assign percentages
                              </h4>

                              <p className="mt-1 text-xs text-gray-500">
                                The percentages must
                                total 100%.
                              </p>
                            </div>

                            <div
                              className={`
                                rounded-full
                                px-3
                                py-1.5
                                text-xs
                                font-bold
                                ${
                                  Math.abs(
                                    (validPreview.entries ||
                                      []).reduce(
                                      (
                                        sum,
                                        row
                                      ) =>
                                        sum +
                                        Number(
                                          row.percent ||
                                            0
                                        ),
                                      0
                                    ) -
                                      100
                                  ) <
                                  0.000001
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                }
                              `}
                            >
                              {(
                                validPreview.entries ||
                                []
                              )
                                .reduce(
                                  (
                                    sum,
                                    row
                                  ) =>
                                    sum +
                                    Number(
                                      row.percent ||
                                        0
                                    ),
                                  0
                                )
                                .toFixed(
                                  1
                                )}
                              %
                            </div>
                          </div>

                          <div className="space-y-3">
                            {participants.map(
                              (username) => {
                                const value =
                                  Number(
                                    splitValues[
                                      username
                                    ] || 0
                                  );

                                return (
                                  <div
                                    key={
                                      username
                                    }
                                    className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900"
                                  >
                                    <div className="mb-2 flex items-center justify-between">
                                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                        {getMemberName(
                                          members,
                                          username
                                        )}
                                      </span>

                                      <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                                        {value.toFixed(
                                          1
                                        )}
                                        %
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={
                                          value
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          updateSplitValue(
                                            username,
                                            Number(
                                              event
                                                .target
                                                .value
                                            )
                                          )
                                        }
                                        className="flex-1 accent-primary-600"
                                      />

                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={
                                          splitValues[
                                            username
                                          ] ??
                                          0
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          updateSplitValue(
                                            username,
                                            Number(
                                              event
                                                .target
                                                .value
                                            )
                                          )
                                        }
                                        className="
                                          w-20
                                          rounded-lg
                                          border
                                          border-gray-200
                                          bg-white
                                          px-2
                                          py-2
                                          text-right
                                          text-xs
                                          font-semibold
                                          outline-none
                                          focus:border-primary-500
                                          dark:border-gray-700
                                          dark:bg-gray-950
                                          dark:text-white
                                        "
                                      />
                                    </div>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        </div>
                      )}

                      {/* SHARES */}

                      {splitType ===
                        "SHARES" && (
                        <div>
                          <div className="mb-4">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                              Assign shares
                            </h4>

                            <p className="mt-1 text-xs text-gray-500">
                              More shares means a larger
                              portion of the bill.
                            </p>
                          </div>

                          <div className="space-y-2">
                            {participants.map(
                              (username) => (
                                <div
                                  key={
                                    username
                                  }
                                  className="
                                    flex
                                    items-center
                                    gap-3
                                    rounded-xl
                                    border
                                    border-gray-200
                                    bg-gray-50
                                    p-3
                                    dark:border-gray-800
                                    dark:bg-gray-900
                                  "
                                >
                                  <Avatar
                                    name={getMemberName(
                                      members,
                                      username
                                    )}
                                  />

                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">
                                      {getMemberName(
                                        members,
                                        username
                                      )}
                                    </p>
                                  </div>

                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={
                                      splitValues[
                                        username
                                      ] ??
                                      0
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateSplitValue(
                                        username,
                                        Number(
                                          event
                                            .target
                                            .value
                                        )
                                      )
                                    }
                                    className="
                                      w-24
                                      rounded-xl
                                      border
                                      border-gray-200
                                      bg-white
                                      px-3
                                      py-2.5
                                      text-center
                                      text-sm
                                      font-bold
                                      outline-none
                                      focus:border-primary-500
                                      focus:ring-4
                                      focus:ring-primary-500/10
                                      dark:border-gray-700
                                      dark:bg-gray-950
                                      dark:text-white
                                    "
                                  />

                                  <span className="text-xs text-gray-400">
                                    shares
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* ADJUSTMENT */}

                      {splitType ===
                        "ADJUSTMENT" && (
                        <div>
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                Adjust individual
                                shares
                              </h4>

                              <p className="mt-1 text-xs leading-5 text-gray-500">
                                Enter a fixed amount for
                                someone. People with no
                                adjustment split the
                                remaining balance equally.
                              </p>
                            </div>

                            {validPreview.valid && (
                              <div
                                className="
                                  flex
                                  shrink-0
                                  items-center
                                  gap-1.5
                                  rounded-full
                                  bg-emerald-50
                                  px-2.5
                                  py-1.5
                                  text-[11px]
                                  font-bold
                                  text-emerald-700
                                  dark:bg-emerald-900/30
                                  dark:text-emerald-300
                                "
                              >
                                <FaCheck className="h-2.5 w-2.5" />
                                Balanced
                              </div>
                            )}
                          </div>

                          <div className="space-y-3">
                            {participants.map(
                              (username) => {
                                const value =
                                  splitValues[
                                    username
                                  ] ?? "";

                                const numValue =
                                  Number(
                                    value || 0
                                  );

                                return (
                                  <div
                                    key={
                                      username
                                    }
                                    className="
                                      group
                                      flex
                                      items-center
                                      gap-3
                                      rounded-xl
                                      border
                                      border-gray-200
                                      bg-white
                                      p-3
                                      transition-all
                                      hover:border-gray-300
                                      hover:shadow-sm
                                      dark:border-gray-800
                                      dark:bg-gray-950
                                      dark:hover:border-gray-700
                                    "
                                  >
                                    <Avatar
                                      name={getMemberName(
                                        members,
                                        username
                                      )}
                                    />

                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">
                                        {getMemberName(
                                          members,
                                          username
                                        )}
                                      </p>

                                      <p className="mt-0.5 text-xs text-gray-400">
                                        Adjustment
                                        amount
                                      </p>
                                    </div>

                                    <div className="relative w-40">
                                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                                        ₹
                                      </span>

                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={
                                          value
                                        }
                                        onChange={(
                                          event
                                        ) => {
                                          let val =
                                            event
                                              .target
                                              .value;

                                          // Block negative input
                                          if (
                                            val &&
                                            Number(
                                              val
                                            ) < 0
                                          ) {
                                            val = "0";
                                          }

                                          updateSplitValue(
                                            username,
                                            val
                                          );
                                        }}
                                        className="
                                          w-full
                                          rounded-lg
                                          border
                                          border-gray-200
                                          bg-gray-50
                                          py-2.5
                                          pl-8
                                          pr-3
                                          text-right
                                          text-sm
                                          font-semibold
                                          outline-none
                                          transition
                                          focus:border-primary-500
                                          focus:bg-white
                                          focus:ring-4
                                          focus:ring-primary-500/10
                                          dark:border-gray-700
                                          dark:bg-gray-900
                                          dark:text-white
                                          dark:focus:border-primary-500
                                          dark:focus:bg-gray-950
                                        "
                                        placeholder="0.00"
                                      />

                                      {numValue >
                                        0 && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-primary-50 text-[10px] font-bold text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
                                          ✓
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        </div>
                      )}

                      {/* ITEMIZED */}

                      {splitType ===
                        "ITEMIZED" && (
                        <div>
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                Add receipt items
                              </h4>

                              <p className="mt-1 text-xs text-gray-500">
                                Add each item and choose
                                who shared it.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={addItem}
                              className="
                                flex
                                shrink-0
                                items-center
                                gap-1.5
                                rounded-lg
                                bg-primary-600
                                px-3
                                py-2
                                text-xs
                                font-bold
                                text-white
                                transition
                                hover:bg-primary-700
                              "
                            >
                              <FaPlus />
                              Add item
                            </button>
                          </div>

                          <div className="space-y-3">
                            {items.map(
                              (
                                item,
                                index
                              ) => (
                                <div
                                  key={
                                    item.id
                                  }
                                  className="
                                    rounded-2xl
                                    border
                                    border-gray-200
                                    bg-gray-50
                                    p-4
                                    dark:border-gray-800
                                    dark:bg-gray-900
                                  "
                                >
                                  <div className="mb-3 flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wide text-gray-400">
                                      Item{" "}
                                      {index +
                                        1}
                                    </span>

                                    {items.length >
                                      1 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeItem(
                                            item.id
                                          )
                                        }
                                        className="
                                          flex
                                          items-center
                                          gap-1
                                          text-xs
                                          font-semibold
                                          text-red-500
                                          hover:text-red-600
                                        "
                                      >
                                        <FaTrash />
                                        Remove
                                      </button>
                                    )}
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                                    <input
                                      type="text"
                                      value={
                                        item.name
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        updateItem(
                                          item.id,
                                          "name",
                                          event
                                            .target
                                            .value
                                        )
                                      }
                                      className="
                                        rounded-xl
                                        border
                                        border-gray-200
                                        bg-white
                                        px-3
                                        py-2.5
                                        text-sm
                                        outline-none
                                        focus:border-primary-500
                                        focus:ring-4
                                        focus:ring-primary-500/10
                                        dark:border-gray-700
                                        dark:bg-gray-950
                                        dark:text-white
                                      "
                                      placeholder="e.g. Pizza"
                                    />

                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                                        ₹
                                      </span>

                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={
                                          item.amount
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          updateItem(
                                            item.id,
                                            "amount",
                                            event
                                              .target
                                              .value
                                          )
                                        }
                                        className="
                                          w-full
                                          rounded-xl
                                          border
                                          border-gray-200
                                          bg-white
                                          py-2.5
                                          pl-7
                                          pr-3
                                          text-right
                                          text-sm
                                          font-semibold
                                          outline-none
                                          focus:border-primary-500
                                          dark:border-gray-700
                                          dark:bg-gray-950
                                          dark:text-white
                                        "
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </div>

                                  <div className="mt-3">
                                    <p className="mb-2 text-xs font-semibold text-gray-500">
                                      Shared by
                                    </p>

                                    <div className="flex flex-wrap gap-2">
                                      {members.map(
                                        (
                                          member
                                        ) => {
                                          const selected =
                                            item.participants.includes(
                                              member.username
                                            );

                                          const name =
                                            member.full_name ||
                                            member.name ||
                                            member.username;

                                          return (
                                            <button
                                              type="button"
                                              key={
                                                member.username
                                              }
                                              onClick={() =>
                                                toggleItemParticipant(
                                                  item.id,
                                                  member.username
                                                )
                                              }
                                              className={`
                                                flex
                                                items-center
                                                gap-1.5
                                                rounded-full
                                                border
                                                px-2.5
                                                py-1.5
                                                text-xs
                                                font-semibold
                                                transition
                                                ${
                                                  selected
                                                    ? "border-primary-500 bg-primary-600 text-white"
                                                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
                                                }
                                              `}
                                            >
                                              {selected && (
                                                <FaCheck className="text-[9px]" />
                                              )}

                                              {name}
                                            </button>
                                          );
                                        }
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </motion.section>
                  </AnimatePresence>
                </form>

                {/* =============================================
                    RIGHT SIDE - LIVE PREVIEW
                ============================================= */}

                <aside
                  className="
                    lg:sticky
                    lg:top-0
                    lg:self-start
                  "
                >
                  <div
                    className="
                      overflow-hidden
                      rounded-2xl
                      border
                      border-gray-200
                      bg-white
                      shadow-sm
                      dark:border-gray-800
                      dark:bg-gray-950
                    "
                  >
                    {/* Preview Header */}

                    <div
                      className="
                        border-b
                        border-gray-200
                        bg-gradient-to-br
                        from-primary-600
                        to-primary-700
                        p-5
                        text-white
                        dark:border-gray-800
                      "
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                            Live preview
                          </p>

                          <h3 className="mt-1 text-lg font-bold">
                            {formatCurrency(
                              Number(
                                amount || 0
                              )
                            )}
                          </h3>

                          <p className="mt-1 text-xs text-white/70">
                            {description ||
                              "New expense"}
                          </p>
                        </div>

                        <div
                          className="
                            flex
                            h-10
                            w-10
                            items-center
                            justify-center
                            rounded-xl
                            bg-white/15
                            backdrop-blur
                          "
                        >
                          <FaReceipt />
                        </div>
                      </div>
                    </div>

                    {/* Status */}

                    <div className="p-4">
                      <div
                        className={`
                          mb-4
                          flex
                          items-center
                          gap-3
                          rounded-xl
                          border
                          p-3
                          ${
                            validPreview.status ===
                            "valid"
                              ? "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-900/20"
                              : "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20"
                          }
                        `}
                      >
                        <div
                          className={`
                            flex
                            h-8
                            w-8
                            shrink-0
                            items-center
                            justify-center
                            rounded-full
                            ${
                              validPreview.status ===
                              "valid"
                                ? "bg-green-500 text-white"
                                : "bg-amber-500 text-white"
                            }
                          `}
                        >
                          {validPreview.status ===
                          "valid" ? (
                            <FaCheck className="text-xs" />
                          ) : (
                            <FaExclamationTriangle className="text-xs" />
                          )}
                        </div>

                        <div>
                          <p
                            className={`
                              text-xs
                              font-bold
                              ${
                                validPreview.status ===
                                "valid"
                                  ? "text-green-800 dark:text-green-300"
                                  : "text-amber-800 dark:text-amber-300"
                              }
                            `}
                          >
                            {validPreview.status ===
                            "valid"
                              ? "Ready to split"
                              : "Needs attention"}
                          </p>

                          <p
                            className={`
                              mt-0.5
                              text-[11px]
                              ${
                                validPreview.status ===
                                "valid"
                                  ? "text-green-700 dark:text-green-400"
                                  : "text-amber-700 dark:text-amber-400"
                              }
                            `}
                          >
                            {
                              validPreview.message
                            }
                          </p>
                        </div>
                      </div>

                      {/* Selected payer */}

                      {payerUsername && (
                        <div className="mb-4 rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
                          <div className="flex items-center gap-3">
                            <Avatar
                              name={getMemberName(
                                members,
                                payerUsername
                              )}
                              selected
                            />

                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                Paid by
                              </p>

                              <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">
                                {getMemberName(
                                  members,
                                  payerUsername
                                )}
                              </p>
                            </div>

                            <FaArrowRight className="text-xs text-gray-300" />
                          </div>
                        </div>
                      )}

                      {/* People */}

                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400">
                          Split breakdown
                        </h4>

                        <span className="text-xs font-semibold text-gray-500">
                          {
                            participants.length
                          }{" "}
                          people
                        </span>
                      </div>

                      <div className="space-y-2">
                        {previewRows.length >
                        0 ? (
                          previewRows.map(
                            (row) => {
                              const name =
                                getMemberName(
                                  members,
                                  row.username
                                );

                              const percentage =
                                amount &&
                                row.amountPaise
                                  ? (row.amountPaise /
                                      toPaise(
                                        amount
                                      )) *
                                    100
                                  : 0;

                              return (
                                <motion.div
                                  layout
                                  key={
                                    row.username
                                  }
                                  className="
                                    rounded-xl
                                    border
                                    border-gray-100
                                    bg-gray-50
                                    p-3
                                    dark:border-gray-800
                                    dark:bg-gray-900
                                  "
                                >
                                  <div className="flex items-center gap-3">
                                    <Avatar
                                      name={
                                        name
                                      }
                                    />

                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-bold text-gray-800 dark:text-gray-200">
                                        {
                                          name
                                        }
                                      </p>

                                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                        <motion.div
                                          initial={{
                                            width: 0,
                                          }}
                                          animate={{
                                            width: `${Math.min(
                                              100,
                                              percentage
                                            )}%`,
                                          }}
                                          className="h-full rounded-full bg-primary-500"
                                        />
                                      </div>

                                      <div className="mt-1 flex gap-2 text-[10px] text-gray-400">
                                        {splitType ===
                                          "PERCENTAGE" &&
                                          row.percent !==
                                            undefined && (
                                            <span>
                                              {Number(
                                                row.percent
                                              ).toFixed(
                                                1
                                              )}
                                              %
                                            </span>
                                          )}

                                        {splitType ===
                                          "SHARES" &&
                                          row.share !==
                                            undefined && (
                                            <span>
                                              {
                                                row.share
                                              }{" "}
                                              shares
                                            </span>
                                          )}

                                        {splitType !==
                                          "PERCENTAGE" &&
                                          splitType !==
                                            "SHARES" && (
                                            <span>
                                              {percentage.toFixed(
                                                1
                                              )}
                                              %
                                            </span>
                                          )}
                                      </div>
                                    </div>

                                    <div className="text-right">
                                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                                        {formatCurrency(
                                          (row.amountPaise ||
                                            0) /
                                            100
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            }
                          )
                        ) : (
                          <div
                            className="
                              rounded-xl
                              border
                              border-dashed
                              border-gray-300
                              p-5
                              text-center
                              dark:border-gray-700
                            "
                          >
                            <FaUsers className="mx-auto mb-2 text-lg text-gray-300" />

                            <p className="text-xs font-semibold text-gray-500">
                              Your split will appear
                              here
                            </p>

                            <p className="mt-1 text-[11px] text-gray-400">
                              Enter an amount and
                              select participants.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Total */}

                      <div
                        className="
                          mt-4
                          border-t
                          border-gray-200
                          pt-4
                          dark:border-gray-800
                        "
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-500">
                            Split total
                          </span>

                          <span
                            className={`
                              text-lg
                              font-black
                              ${
                                validPreview.valid
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-gray-900 dark:text-white"
                              }
                            `}
                          >
                            {formatCurrency(
                              totalPreviewPaise /
                                100
                            )}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-xs text-gray-400">
                            Bill total
                          </span>

                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                            {formatCurrency(
                              Number(
                                amount || 0
                              )
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>

            {/* =================================================
                FOOTER
            ================================================= */}

            <div
              className="
                shrink-0
                border-t
                border-gray-200
                bg-white
                px-4
                py-3
                dark:border-gray-800
                dark:bg-gray-950
                sm:px-6
              "
            >
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
                <div className="hidden items-center gap-2 text-xs text-gray-400 sm:flex">
                  <FaUserCheck />

                  <span>
                    {participants.length}{" "}
                    people included
                  </span>
                </div>

                <div className="flex w-full gap-2 sm:w-auto">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={loading}
                    className="
                      flex-1
                      rounded-xl
                      border
                      border-gray-200
                      bg-white
                      px-5
                      py-3
                      text-sm
                      font-bold
                      text-gray-700
                      transition
                      hover:bg-gray-50
                      disabled:opacity-50
                      dark:border-gray-700
                      dark:bg-gray-900
                      dark:text-gray-200
                      dark:hover:bg-gray-800
                      sm:flex-none
                    "
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    onClick={handleSubmit}
                    disabled={
                      loading ||
                      !validPreview.valid
                    }
                    className="
                      flex
                      flex-1
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      bg-primary-600
                      px-6
                      py-3
                      text-sm
                      font-bold
                      text-white
                      shadow-lg
                      shadow-primary-500/20
                      transition
                      hover:bg-primary-700
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                      sm:flex-none
                    "
                  >
                    {loading ? (
                      <>
                        <span
                          className="
                            h-4
                            w-4
                            animate-spin
                            rounded-full
                            border-2
                            border-white/30
                            border-t-white
                          "
                        />

                        Adding...
                      </>
                    ) : (
                      <>
                        <FaCheck />

                        Add expense
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddExpenseModal;