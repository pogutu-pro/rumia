/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';

const load = jest.fn();
const preload = jest.fn();
jest.mock('@/lib/youtube-api-loader', () => ({ loadYouTubeAPI: (...a: unknown[]) => load(...a), preloadYouTubeAPI: () => preload() }));
// eslint-disable-next-line @next/next/no-img-element
const Img = ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />;
jest.mock('next/image', () => ({ __esModule: true, default: (p: { src: string; alt: string }) => Img(p) }));

import { VideoPlayer } from '../video-player';

/** A stand-in for window.YT whose player the test drives by hand. */
function fakeYT() {
  const handlers: { onReady?: (e: unknown) => void; onError?: () => void; onStateChange?: (e: { data: number }) => void } = {};
  const player = {
    destroy: jest.fn(),
    playVideo: jest.fn(),
    pauseVideo: jest.fn(),
    setVolume: jest.fn(),
    isMuted: () => false,
    getDuration: () => 30,
    getCurrentTime: () => 0,
    getPlayerState: () => 1,
  };
  const YT = {
    PlayerState: { PLAYING: 1, BUFFERING: 3 },
    Player: jest.fn((_el: unknown, opts: { events: typeof handlers }) => {
      Object.assign(handlers, opts.events);
      return player;
    }),
  };
  return { YT, handlers, player };
}

const press = () => fireEvent.click(screen.getByRole('button', { name: /play/i }));
const render_ = () => render(<VideoPlayer youtubeId="abc123" title="Tour" portrait={false} />);

beforeEach(() => {
  jest.useFakeTimers();
  load.mockReset();
  preload.mockReset();
});
afterEach(() => jest.useRealTimers());

describe('VideoPlayer start-up', () => {
  it('starts fetching the player as soon as it appears, before Play is pressed', () => {
    render_();
    expect(preload).toHaveBeenCalledTimes(1);
    expect(load).not.toHaveBeenCalled();
  });

  it('asks the poster image that always exists, not the one that often 404s', () => {
    render_();
    expect((document.querySelector('img') as HTMLImageElement).src).toContain('/vi/abc123/hqdefault.jpg');
  });

  it('plays through the custom player once it is ready', async () => {
    const { YT, handlers, player } = fakeYT();
    load.mockResolvedValue(YT);
    render_();
    press();
    await act(async () => {});
    act(() => handlers.onReady?.({ target: player }));
    expect(player.playVideo).toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says the connection is slow after a few seconds, with a way out, but keeps waiting', async () => {
    load.mockReturnValue(new Promise(() => {})); // never arrives
    render_();
    press();
    expect(screen.queryByText(/still loading/i)).toBeNull();
    act(() => void jest.advanceTimersByTime(6100));
    expect(screen.getByText(/still loading/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /watch on youtube/i }).getAttribute('href')).toContain('watch?v=abc123');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('VideoPlayer fallbacks', () => {
  it('plays in YouTube\'s own player when the API script cannot be loaded, instead of a dead end', async () => {
    load.mockRejectedValue(new Error('timed out'));
    render_();
    press();
    await act(async () => {});
    const frame = document.querySelector('iframe') as HTMLIFrameElement;
    expect(frame.src).toContain('youtube.com/embed/abc123');
    expect(frame.src).toContain('autoplay=1');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('switches to the plain embed when the player is created but never becomes ready', async () => {
    const { YT, player } = fakeYT();
    load.mockResolvedValue(YT);
    render_();
    press();
    await act(async () => {});
    act(() => void jest.advanceTimersByTime(15100));
    expect(document.querySelector('iframe')).toBeTruthy();
    expect(player.destroy).toHaveBeenCalled();
  });

  it('shows the error with a YouTube link only for a real player error (e.g. embedding switched off)', async () => {
    const { YT, handlers } = fakeYT();
    load.mockResolvedValue(YT);
    render_();
    press();
    await act(async () => {});
    act(() => handlers.onError?.());
    expect(screen.getByRole('alert').textContent).toMatch(/could not be played/i);
    expect(screen.getByRole('link', { name: /watch on youtube/i })).toBeTruthy();
    // and the later "never became ready" timer must not override it
    act(() => void jest.advanceTimersByTime(20000));
    expect(document.querySelector('iframe')).toBeNull();
  });
});
