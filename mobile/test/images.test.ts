import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ uploads: vi.fn(), queueImage: vi.fn() }));
vi.mock('../modules/dayflow-native', () => ({ repository: { uploads: mocks.uploads }, native: { queueImage: mocks.queueImage } }));
import { copyPendingImages } from '../src/lib/images';

it('multiple recoveries own separate pending image identities and keep canonical images intact', async () => {
  mocks.uploads.mockResolvedValue([{ localId: 'source-image', entityId: 'original', uri: 'file:///private/source', mime: 'image/png' }]);
  mocks.queueImage.mockImplementation(async (_user, _entity, id) => JSON.stringify({ localId: `image-for-${id}` }));
  const original = '<p>Recovered content</p><img src="local:source-image" data-local-id="source-image"><img src="/uploads/user/canonical.webp">';
  const first = await copyPendingImages('user', 'note', 'first', original);
  const second = await copyPendingImages('user', 'note', 'second', original);
  expect(first).toContain('src="local:image-for-first" data-local-id="image-for-first"');
  expect(second).toContain('src="local:image-for-second" data-local-id="image-for-second"');
  expect(first).not.toContain('source-image'); expect(second).not.toContain('source-image');
  expect(first).toContain('src="/uploads/user/canonical.webp"');
  expect(original).toContain('src="local:source-image"');
  expect(mocks.queueImage).toHaveBeenCalledWith('user', 'note', 'first', 'file:///private/source', 'image/png');
  expect(mocks.queueImage).toHaveBeenCalledWith('user', 'note', 'second', 'file:///private/source', 'image/png');
});
