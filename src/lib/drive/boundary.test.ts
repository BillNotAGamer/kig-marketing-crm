// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MockDriveClient } from "./client";

const folder = "allowed-folder";
function client(files: ConstructorParameters<typeof MockDriveClient>[0]) {
  return new MockDriveClient(files, undefined, folder);
}
describe("Google Drive allowed-folder boundary", () => {
  it("accepts direct and nested descendants", async () => {
    const drive = client({
      child: { parents: [folder] },
      nested: { parents: ["sub-folder"] },
      "sub-folder": {
        mimeType: "application/vnd.google-apps.folder",
        parents: [folder],
      },
    });
    await expect(drive.getFileMetadata("child")).resolves.toMatchObject({
      id: "child",
    });
    await expect(drive.getFileMetadata("nested")).resolves.toMatchObject({
      id: "nested",
    });
  });
  it("rejects outside, inaccessible, cyclic and over-depth ancestry", async () => {
    const files: Record<string, { parents?: string[]; mimeType?: string }> = {
      outside: { parents: ["other"] },
      other: { parents: [] },
      missing: { parents: ["inaccessible"] },
      cyclic: { parents: ["a"] },
      a: { parents: ["b"] },
      b: { parents: ["a"] },
      deep: { parents: ["d0"] },
    };
    for (let i = 0; i < 35; i++)
      files[`d${i}`] = { parents: i === 34 ? [folder] : [`d${i + 1}`] };
    const drive = client(files);
    for (const id of ["outside", "missing", "cyclic", "deep"])
      await expect(drive.getFileMetadata(id)).rejects.toMatchObject({
        status: 403,
      });
  });
  it("preserves Shared Drive enforcement", async () => {
    const drive = new MockDriveClient(
      { file: { driveId: "wrong", parents: [folder] } },
      "approved",
      folder,
    );
    await expect(drive.getFileMetadata("file")).rejects.toMatchObject({
      status: 403,
    });
  });
});
