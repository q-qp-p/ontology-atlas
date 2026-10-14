import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installExternalLinkOpener, isExternalHttpUrl } from './tauri-external-link';

const invoke = vi.fn();
let tauri = true;

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => tauri,
  invoke: (...args: unknown[]) => invoke(...args),
}));

function anchor(href: string, target = '_blank'): HTMLAnchorElement {
  const a = document.createElement('a');
  a.setAttribute('href', href);
  if (target) a.setAttribute('target', target);
  a.textContent = '설치 방법';
  document.body.append(a);
  return a;
}

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue(undefined);
  tauri = true;
  document.body.innerHTML = '';
});

describe('links that leave the app', () => {
  it('in the app a click is intercepted and handed to the OS', () => {
    const remove = installExternalLinkOpener();
    const link = anchor('https://example.com/install');

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);

    expect(invoke).toHaveBeenCalledWith('open_external_url', {
      url: 'https://example.com/install',
    });
    // The default must be prevented, or the WebView **navigates away** to that URL.
    expect(event.defaultPrevented).toBe(true);
    remove();
  });

  it('clicking text inside the link opens it too', () => {
    const remove = installExternalLinkOpener();
    const link = anchor('https://example.com/x');
    const inner = document.createElement('span');
    link.append(inner);

    inner.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(invoke).toHaveBeenCalledTimes(1);
    remove();
  });

  it('on the web it is not attached at all, since the browser already opens it', () => {
    tauri = false;
    const remove = installExternalLinkOpener();
    const link = anchor('https://example.com/x');

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);

    expect(invoke).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    remove();
  });

  it('leaves in-app navigation alone', () => {
    const remove = installExternalLinkOpener();
    for (const href of ['/ko/topology/', '#section', 'mailto:a@b.c']) {
      const link = anchor(href, '');
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      link.dispatchEvent(event);
      expect(event.defaultPrevented, `${href} was intercepted`).toBe(false);
    }
    expect(invoke).not.toHaveBeenCalled();
    remove();
  });

  it('stops listening once detached', () => {
    const remove = installExternalLinkOpener();
    remove();
    anchor('https://example.com/x').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it('only http/https leave the app, an allow list rather than a deny list', () => {
    expect(isExternalHttpUrl('https://example.com')).toBe(true);
    expect(isExternalHttpUrl('http://example.com')).toBe(true);
    for (const bad of [
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:text/html,x',
      'ftp://example.com',
      '/ko/topology/',
      'https://exa mple.com',
    ]) {
      expect(isExternalHttpUrl(bad), `tried to open ${bad}`).toBe(false);
    }
  });
});
