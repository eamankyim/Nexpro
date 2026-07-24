import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import api from '../api';
import customDropdownService from '../customDropdownService';

describe('customDropdownService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unwraps { success, data: [] } from api interceptor result', async () => {
    api.get.mockResolvedValue({
      success: true,
      data: [
        { value: 'Vinyl Wrap', label: 'Vinyl Wrap' },
        { value: 'Custom Install', label: 'Custom Install' },
      ],
    });

    const options = await customDropdownService.getCustomOptions('job_category');
    expect(options).toEqual([
      { value: 'Vinyl Wrap', label: 'Vinyl Wrap' },
      { value: 'Custom Install', label: 'Custom Install' },
    ]);
  });

  it('returns empty array when payload is missing', async () => {
    api.get.mockResolvedValue({ success: true });
    await expect(customDropdownService.getCustomOptions('job_category')).resolves.toEqual([]);
  });

  it('saves custom option with label fallback and unwraps data', async () => {
    api.post.mockResolvedValue({
      success: true,
      data: { value: 'Vinyl Wrap', label: 'Vinyl Wrap' },
    });

    const saved = await customDropdownService.saveCustomOption('job_category', '  Vinyl Wrap  ');
    expect(api.post).toHaveBeenCalledWith('/custom-dropdowns', {
      dropdownType: 'job_category',
      value: 'Vinyl Wrap',
      label: 'Vinyl Wrap',
    });
    expect(saved).toEqual({ value: 'Vinyl Wrap', label: 'Vinyl Wrap' });
  });
});
