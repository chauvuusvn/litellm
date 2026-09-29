import { describe, expect, it } from "vitest";
import {
  defaultJevClassifierConfig,
  jevClassifierConfigSchema,
  jevClassifierFormConfigSchema,
  normalizeJevClassifierConfig,
  transitionDecisionModelProvider,
} from "./jev_classifier_config";

describe("decision model configuration", () => {
  it("keeps legacy Jev defaults but requires an explicit Laya checkpoint", () => {
    expect(jevClassifierConfigSchema.parse({})).toEqual(defaultJevClassifierConfig());
    expect(jevClassifierConfigSchema.safeParse({ provider: "laya" }).success).toBe(false);
    expect(jevClassifierConfigSchema.safeParse({ provider: "unknown", model: "english" }).success).toBe(false);
    expect(jevClassifierConfigSchema.safeParse({ provider: "laya", model: "  " }).success).toBe(false);
    expect(jevClassifierConfigSchema.safeParse({ provider: "laya", model: "automatic" }).success).toBe(false);
  });

  it("preserves entered connection overrides when saving and strips hidden connections when loading", () => {
    const input = {
      provider: "laya",
      model: " multilingual ",
      timeout_ms: 4500,
      api_base: " http://laya.test:8000 ",
      api_key: " own-key ",
    };
    const edited = normalizeJevClassifierConfig(jevClassifierFormConfigSchema.parse(input));
    const expected = {
      provider: "laya",
      model: "multilingual",
      timeout_ms: 4500,
      api_base: "http://laya.test:8000",
      api_key: "own-key",
    };
    expect(edited).toEqual(expected);
    expect(jevClassifierConfigSchema.parse(edited)).toEqual({
      provider: "laya",
      model: "multilingual",
      timeout_ms: 4500,
    });
  });

  it("preserves explicit null clears while leaving untouched or blank transports omitted", () => {
    const config = { ...defaultJevClassifierConfig(), provider: "laya" as const, model: "english" };
    expect(
      normalizeJevClassifierConfig(jevClassifierFormConfigSchema.parse({ ...config, api_base: null, api_key: null })),
    ).toEqual({ ...config, api_base: null, api_key: null });
    expect(normalizeJevClassifierConfig({ ...config, api_key: null })).toEqual({ ...config, api_key: null });
    expect(normalizeJevClassifierConfig(config)).toEqual(config);
    expect(normalizeJevClassifierConfig({ ...config, api_base: "  ", api_key: " " })).toEqual(config);
  });

  it("clears both transports when switching providers while retaining shared settings", () => {
    const configured = {
      ...defaultJevClassifierConfig(),
      model: "jev-custom",
      api_base: "https://jev.test",
      api_key: "secret",
      instructions: "Classify into tiers",
      circuit_breaker_enabled: false,
    };
    expect(transitionDecisionModelProvider(configured, "typesafe")).toBe(configured);
    const laya = transitionDecisionModelProvider(configured, "laya");
    const expectedLaya = {
      provider: "laya",
      model: "english",
      timeout_ms: 3000,
      instructions: "Classify into tiers",
      circuit_breaker_enabled: false,
    };
    expect(laya).toEqual(expectedLaya);
    expect(
      transitionDecisionModelProvider({ ...laya, api_base: "http://laya.test", api_key: "laya-secret" }, "typesafe"),
    ).toEqual({ ...laya, provider: "typesafe", model: "jev-latest" });
  });
});
