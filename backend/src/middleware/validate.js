// src/middleware/validate.js
import { z } from 'zod';

export const validate = (schema) => {
  return (req, res, next) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Validation schemas
export const schemas = {
  register: z.object({
    body: z.object({
      username: z.string().min(3).max(50),
      email: z.string().email(),
      password: z.string().min(6),
      full_name: z.string().optional()
    })
  }),

  login: z.object({
    body: z.object({
      username: z.string().min(1),
      password: z.string().min(1)
    })
  }),

  createGroup: z.object({
    body: z.object({
      name: z.string().min(1).max(255),
      password: z.string().min(6).optional()
    })
  }),

  joinGroup: z.object({
    body: z.object({
      group_id: z.string().uuid(),
      password: z.string().optional()
    })
  }),

  createTrip: z.object({
    body: z.object({
      group_id: z.string().uuid(),
      name: z.string().min(1).max(255),
      location: z.string().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      description: z.string().optional()
    })
  }),

  updateTrip: z.object({
    params: z.object({
      id: z.string().uuid()
    }),
    body: z.object({
      name: z.string().min(1).max(255).optional(),
      location: z.string().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      description: z.string().optional()
    })
  }),

  addExpense: z.object({
    body: z.object({
      trip_id: z.string().uuid(),
      amount: z.coerce.number().positive(),
      description: z.string().optional(),
      category: z.string().optional().nullable(),
      payer_username: z.string().optional(),
      participants: z.array(z.string()).min(1),
      split_type: z.enum(['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES', 'ADJUSTMENT', 'ITEMIZED']).optional(),
      split_data: z.record(z.any()).optional().default({}),
    })
  }),

  addPlace: z.object({
    body: z.object({
      trip_id: z.string().uuid(),
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      latitude: z.string().optional(),
      longitude: z.string().optional() 
    })
  })
};
