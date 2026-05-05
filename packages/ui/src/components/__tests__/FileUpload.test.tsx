import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import FileUpload from '../FileUpload';

describe('FileUpload', () => {
  it('renders upload button', () => {
    const { getByText } = render(<FileUpload onUpload={() => {}} isLoading={false} />);
    expect(getByText('Choose File')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    const { getByText } = render(<FileUpload onUpload={() => {}} isLoading={true} />);
    expect(getByText('Analyzing...')).toBeInTheDocument();
  });
});
