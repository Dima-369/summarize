import type { CliProvider } from "../config.js";
import { resolveConfigState } from "./run-config.js";
import { resolveEnvState } from "./run-env.js";

export async function resolveRunContextState({
  env,
  envForRun,
  programOpts,
  languageExplicitlySet,
  videoModeExplicitlySet,
  cliFlagPresent,
  cliProviderArg,
}: {
  env: Record<string, string | undefined>;
  envForRun: Record<string, string | undefined>;
  programOpts: Record<string, unknown>;
  languageExplicitlySet: boolean;
  videoModeExplicitlySet: boolean;
  cliFlagPresent: boolean;
  cliProviderArg: CliProvider | null;
}): Promise<{
  env: Record<string, string | undefined>;
  envForRun: Record<string, string | undefined>;
  programOpts: Record<string, unknown>;
  languageExplicitlySet: boolean;
  videoModeExplicitlySet: boolean;
  cliFlagPresent: boolean;
  cliProviderArg: CliProvider | null;
} & ReturnType<typeof resolveConfigState> &
  Awaited<ReturnType<typeof resolveEnvState>>> {
  const configState = resolveConfigState({
    envForRun,
    programOpts,
    languageExplicitlySet,
    videoModeExplicitlySet,
    cliFlagPresent,
    cliProviderArg,
  });
  const envState = await resolveEnvState({
    env,
    envForRun,
    configForCli: configState.configForCli,
  });
  return {
    env,
    envForRun,
    programOpts,
    languageExplicitlySet,
    videoModeExplicitlySet,
    cliFlagPresent,
    cliProviderArg,
    ...configState,
    ...envState,
  };
}
