import type {
  OmniResponse,
  OmniProposalResponse,
  OmniQueryResponse,
  OmniConfirmResult,
} from "./types";

export function isOmniProposal(
  response: OmniResponse
): response is OmniProposalResponse {
  return "kind" in response && response.kind === "proposal";
}

export function isOmniQuery(
  response: OmniResponse
): response is OmniQueryResponse {
  return "kind" in response && response.kind === "response";
}

export function isOmniConfirmResult(
  response: OmniResponse
): response is OmniConfirmResult {
  return "kind" in response && response.kind === "result";
}
