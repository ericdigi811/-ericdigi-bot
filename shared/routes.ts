import { z } from "zod";
import { contactSchema, statsSchema, dustRequestSchema } from "./schema";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  stats: {
    get: {
      method: "GET" as const,
      path: "/api/stats" as const,
      responses: {
        200: statsSchema,
      },
    },
  },
  contacts: {
    list: {
      method: "GET" as const,
      path: "/api/contacts" as const,
      responses: {
        200: z.array(contactSchema),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/contacts" as const,
      input: contactSchema.omit({ id: true }),
      responses: {
        201: contactSchema,
        400: errorSchemas.validation,
      },
    }
  },
  dust: {
    handle: {
      method: "POST" as const,
      path: "/dust" as const, // This route specifically asked for by user
      input: dustRequestSchema,
      responses: {
        200: z.any(),
        400: errorSchemas.validation,
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
