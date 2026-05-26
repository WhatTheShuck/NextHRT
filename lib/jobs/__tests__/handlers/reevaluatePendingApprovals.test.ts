import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApprovalService } = vi.hoisted(() => ({
  mockApprovalService: { reevaluatePendingRequests: vi.fn() },
}));

vi.mock("@/lib/services/approvalService", () => ({
  approvalService: mockApprovalService,
}));

import { reevaluatePendingApprovalsHandler } from "@/lib/jobs/handlers/reevaluatePendingApprovals";

beforeEach(() => vi.clearAllMocks());

describe("reevaluatePendingApprovalsHandler", () => {
  it("calls approvalService.reevaluatePendingRequests and returns success", async () => {
    mockApprovalService.reevaluatePendingRequests.mockResolvedValue(undefined);

    const result = await reevaluatePendingApprovalsHandler({});

    expect(mockApprovalService.reevaluatePendingRequests).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ success: true });
  });

  it("propagates errors from approvalService", async () => {
    mockApprovalService.reevaluatePendingRequests.mockRejectedValue(new Error("DB error"));

    await expect(reevaluatePendingApprovalsHandler({})).rejects.toThrow("DB error");
  });
});
