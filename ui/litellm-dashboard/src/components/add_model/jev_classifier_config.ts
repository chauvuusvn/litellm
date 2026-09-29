import { z } from "zod";

export const LAYA_CHECKPOINTS = ["english", "multilingual", "typed-decisions"] as const;
const layaCheckpointSchema = z.enum(LAYA_CHECKPOINTS);

export const isLayaCheckpoint = (model: string): boolean => layaCheckpointSchema.safeParse(model).success;

const jevClassifierConfigFields = {
  provider: z.enum(["typesafe", "laya"]).optional(),
  model: z.string().trim().optional(),
  timeout_ms: z.number().int().positive().default(3000),
  instructions: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  circuit_breaker_enabled: z.boolean().optional(),
  circuit_breaker_cooldown_seconds: z.number().finite().positive().optional(),
};

const validateDecisionModel = (config: { provider?: string; model?: string }, context: z.RefinementCtx) => {
  if (config.provider === "laya" && !layaCheckpointSchema.safeParse(config.model).success) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["model"], message: "Choose a supported Laya checkpoint" });
  } else if (config.model === "") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["model"], message: "Enter a model" });
  }
};

const withModelDefault = <T extends { provider?: string; model?: string }>(config: T) => ({
  ...config,
  model: config.model ?? (config.provider === "laya" ? "" : "jev-latest"),
});

export const storedJevClassifierConfigSchema = z.object(jevClassifierConfigFields).transform(withModelDefault);

export const jevClassifierConfigSchema = z
  .object(jevClassifierConfigFields)
  .superRefine(validateDecisionModel)
  .transform(withModelDefault);

export const jevClassifierFormConfigSchema = z
  .object({
    ...jevClassifierConfigFields,
    api_base: z.string().trim().nullish(),
    api_key: z.string().trim().nullish(),
  })
  .superRefine(validateDecisionModel)
  .transform(withModelDefault);

export type JevClassifierConfig = z.infer<typeof jevClassifierFormConfigSchema>;
export type DecisionModelProvider = NonNullable<JevClassifierConfig["provider"]>;

export const defaultJevClassifierConfig = (): JevClassifierConfig => jevClassifierConfigSchema.parse({});

export const transitionDecisionModelProvider = (
  config: JevClassifierConfig,
  provider: DecisionModelProvider,
): JevClassifierConfig => {
  if ((config.provider ?? "typesafe") === provider) return config;
  const { api_base, api_key, ...settings } = config;
  return { ...settings, provider, model: provider === "laya" ? "english" : "jev-latest" };
};

export const normalizeJevClassifierConfig = (
  config: JevClassifierConfig = defaultJevClassifierConfig(),
): JevClassifierConfig => ({
  ...(config.provider && { provider: config.provider }),
  model: config.model.trim(),
  timeout_ms: config.timeout_ms,
  ...(config.api_base === null && { api_base: null }),
  ...(config.api_base?.trim() && { api_base: config.api_base.trim() }),
  ...(config.api_key === null && { api_key: null }),
  ...(config.api_key?.trim() && { api_key: config.api_key.trim() }),
  ...(config.instructions?.trim() && { instructions: config.instructions.trim() }),
  ...(config.circuit_breaker_enabled !== undefined && { circuit_breaker_enabled: config.circuit_breaker_enabled }),
  ...(config.circuit_breaker_cooldown_seconds !== undefined && {
    circuit_breaker_cooldown_seconds: config.circuit_breaker_cooldown_seconds,
  }),
});
