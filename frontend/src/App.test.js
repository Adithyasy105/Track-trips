import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AICopilotTab } from './components/trips/AICopilotTab';
import { FloatingAICopilotButton } from './components/FloatingAICopilotButton';

jest.mock('./services/api', () => ({
  aiAPI: {
    copilotChat: jest.fn(),
  },
}));

describe('AICopilotTab', () => {
  it('renders a scrollable chat panel with an anchored composer footer', () => {
    render(<AICopilotTab tripId="trip-123" />);

    const chatPanel = screen.getByRole('log');
    const composerDock = screen.getByTestId('ai-copilot-composer-dock');

    expect(chatPanel).toHaveClass('overflow-y-auto');
    expect(chatPanel).toHaveClass('overscroll-contain');
    expect(composerDock).toHaveClass('flex-shrink-0');
    expect(composerDock).not.toHaveClass('fixed');
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });
});

describe('FloatingAICopilotButton', () => {
  it('shows the quick add place action above AI when the trip is on the places tab in mobile view', () => {
    window.innerWidth = 390;

    render(
      <MemoryRouter initialEntries={['/trips/trip-123']}>
        <FloatingAICopilotButton />
      </MemoryRouter>
    );

    fireEvent(window, new CustomEvent('active-tab-changed', { detail: 'places' }));

    expect(screen.getByLabelText('Quick add place')).toBeInTheDocument();
    expect(screen.getByLabelText('Open AI Copilot')).toBeInTheDocument();
  });

  it('shows the quick add expense action above AI when the trip is on the expenses tab in mobile view', () => {
    window.innerWidth = 390;

    render(
      <MemoryRouter initialEntries={['/trips/trip-123']}>
        <FloatingAICopilotButton />
      </MemoryRouter>
    );

    fireEvent(window, new CustomEvent('active-tab-changed', { detail: 'expenses' }));

    expect(screen.getByLabelText('Quick add expense')).toBeInTheDocument();
    expect(screen.getByLabelText('Open AI Copilot')).toBeInTheDocument();
  });
});
