import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AlbumShareDialog } from "~/components/album-share-dialog";
import { I18nProvider } from "~/lib/i18n";

describe("AlbumShareDialog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps a single Escape listener across parent rerenders and uses the latest onClose", () => {
    const addListenerSpy = vi.spyOn(document, "addEventListener");
    const removeListenerSpy = vi.spyOn(document, "removeEventListener");
    const firstOnClose = vi.fn();
    const secondOnClose = vi.fn();
    const thirdOnClose = vi.fn();

    const { rerender, unmount } = render(
      <I18nProvider>
        <AlbumShareDialog
          albumName="Spring"
          createdToken={null}
          errorMessage={null}
          infoMessage={null}
          isCreating={false}
          isLoading={false}
          links={[]}
          onClose={firstOnClose}
          onCopyLink={vi.fn()}
          onCopyToken={vi.fn()}
          onCreate={vi.fn()}
          onRevoke={vi.fn()}
          revokeBusyLinkId={null}
        />
      </I18nProvider>,
    );

    rerender(
      <I18nProvider>
        <AlbumShareDialog
          albumName="Spring"
          createdToken={null}
          errorMessage={null}
          infoMessage="updated"
          isCreating={false}
          isLoading={false}
          links={[]}
          onClose={secondOnClose}
          onCopyLink={vi.fn()}
          onCopyToken={vi.fn()}
          onCreate={vi.fn()}
          onRevoke={vi.fn()}
          revokeBusyLinkId={null}
        />
      </I18nProvider>,
    );

    rerender(
      <I18nProvider>
        <AlbumShareDialog
          albumName="Spring"
          createdToken={null}
          errorMessage={null}
          infoMessage="updated-again"
          isCreating={false}
          isLoading={false}
          links={[]}
          onClose={thirdOnClose}
          onCopyLink={vi.fn()}
          onCopyToken={vi.fn()}
          onCreate={vi.fn()}
          onRevoke={vi.fn()}
          revokeBusyLinkId={null}
        />
      </I18nProvider>,
    );

    const keydownAdds = addListenerSpy.mock.calls.filter(
      ([type]) => type === "keydown",
    );
    const keydownRemovesBeforeUnmount = removeListenerSpy.mock.calls.filter(
      ([type]) => type === "keydown",
    );

    expect(keydownAdds).toHaveLength(1);
    expect(keydownRemovesBeforeUnmount).toHaveLength(0);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(firstOnClose).not.toHaveBeenCalled();
    expect(secondOnClose).not.toHaveBeenCalled();
    expect(thirdOnClose).toHaveBeenCalledTimes(1);

    unmount();

    const keydownRemoves = removeListenerSpy.mock.calls.filter(
      ([type]) => type === "keydown",
    );

    expect(keydownRemoves).toHaveLength(1);
    expect(keydownRemoves[0]?.[1]).toBe(keydownAdds[0]?.[1]);
  });
});
