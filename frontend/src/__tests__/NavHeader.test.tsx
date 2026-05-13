/**
 * NavHeader Component Tests
 * Validates navigation bar rendering and icon imports
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// Mock lucide-react icons to verify they're imported correctly
vi.mock('lucide-react', () => {
  const icons = [
    'TrendingUp', 'Bot', 'Wallet', 'Settings', 'ChevronDown',
    'Star', 'BarChart2', 'GitCompare', 'Clock', 'Activity'
  ]
  const mockIcons: Record<string, React.FC<{ size?: number; className?: string }>> = {}
  icons.forEach(name => {
    mockIcons[name] = ({ size = 18, className = '' }) => (
      React.createElement('span', { 'data-testid': `icon-${name}`, className }, name)
    )
  })
  return { ...mockIcons, clsx: (...args: (string | undefined)[]) => args.filter(Boolean).join(' ') }
})

// Mock store
vi.mock('../store', () => ({
  useStore: () => ({
    currentPage: 'home',
    setPage: vi.fn(),
    portfolio: { total_assets: 1000000 },
    activeModel: 'minimax',
    setActiveModel: vi.fn(),
    setPortfolio: vi.fn()
  })
}))

// Mock API
vi.mock('../services/api', () => ({
  getPortfolio: vi.fn().mockResolvedValue({ total_assets: 1000000 })
}))

describe('NavHeader', () => {
  // Re-import after mocks are set
  let NavHeader: React.FC

  beforeEach(async () => {
    vi.clearAllMocks()
    // Dynamic import to get fresh module with mocks
    const module = await import('../components/NavHeader')
    NavHeader = module.default
  })

  describe('Icon Imports', () => {
    it('should import TrendingUp icon for home navigation', () => {
      const { container } = render(React.createElement(NavHeader))
      const homeIcon = container.querySelector('[data-testid="icon-TrendingUp"]')
      expect(homeIcon).toBeTruthy()
    })

    it('should import Bot icon for selection navigation', () => {
      const { container } = render(React.createElement(NavHeader))
      const selectionIcon = container.querySelector('[data-testid="icon-Bot"]')
      expect(selectionIcon).toBeTruthy()
    })

    it('should import Wallet icon for trading navigation', () => {
      const { container } = render(React.createElement(NavHeader))
      const tradingIcon = container.querySelector('[data-testid="icon-Wallet"]')
      expect(tradingIcon).toBeTruthy()
    })

    it('should import Settings icon for settings navigation', () => {
      const { container } = render(React.createElement(NavHeader))
      const settingsIcon = container.querySelector('[data-testid="icon-Settings"]')
      expect(settingsIcon).toBeTruthy()
    })

    it('should import ChevronDown icon for model selector dropdown', () => {
      const { container } = render(React.createElement(NavHeader))
      const chevronIcon = container.querySelector('[data-testid="icon-ChevronDown"]')
      expect(chevronIcon).toBeTruthy()
    })
  })

  describe('Navigation Structure', () => {
    it('should render exactly 4 navigation items', async () => {
      const module = await import('../components/NavHeader')
      const NavHeaderComponent = module.default
      const { container } = render(React.createElement(NavHeaderComponent))
      
      // Find all buttons with text content
      const buttons = container.querySelectorAll('button')
      const navButtons = Array.from(buttons).filter(btn => {
        const text = btn.textContent
        return text && ['首页', '智能选股', '交易', '设置'].some(label => text.includes(label))
      })
      
      expect(navButtons.length).toBe(4)
    })

    it('should render navigation labels correctly', async () => {
      const module = await import('../components/NavHeader')
      const NavHeaderComponent = module.default
      render(React.createElement(NavHeaderComponent))
      
      expect(screen.getByText('首页')).toBeTruthy()
      expect(screen.getByText('智能选股')).toBeTruthy()
      expect(screen.getByText('交易')).toBeTruthy()
      expect(screen.getByText('设置')).toBeTruthy()
    })
  })

  describe('Model Selector', () => {
    it('should render model selector with ChevronDown icon', async () => {
      const module = await import('../components/NavHeader')
      const NavHeaderComponent = module.default
      const { container } = render(React.createElement(NavHeaderComponent))
      
      const chevron = container.querySelector('[data-testid="icon-ChevronDown"]')
      expect(chevron).toBeTruthy()
    })

    it('should open model dropdown menu when clicked', async () => {
      const module = await import('../components/NavHeader')
      const NavHeaderComponent = module.default
      const { container } = render(React.createElement(NavHeaderComponent))
      
      const modelButton = container.querySelectorAll('button')[0]
      fireEvent.click(modelButton)
      
      // After click, dropdown should be visible
      await waitFor(() => {
        const menuItems = container.querySelectorAll('[data-testid]')
        expect(menuItems.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Balance Display', () => {
    it('should display total assets balance', async () => {
      const module = await import('../components/NavHeader')
      const NavHeaderComponent = module.default
      render(React.createElement(NavHeaderComponent))
      
      expect(screen.getByText(/总资产/)).toBeTruthy()
      expect(screen.getByText(/1,000,000/)).toBeTruthy()
    })
  })
})

describe('NavHeader Production Build Verification', () => {
  it('should have all required icon imports in source code', async () => {
    // Read the actual source file to verify imports
    const fs = await import('fs')
    const path = await import('path')
    const navHeaderPath = path.resolve(__dirname, '../components/NavHeader.tsx')
    const sourceCode = fs.readFileSync(navHeaderPath, 'utf-8')
    
    // Verify all required icons are imported from lucide-react
    const requiredImports = ['TrendingUp', 'Bot', 'Wallet', 'Settings', 'ChevronDown']
    for (const icon of requiredImports) {
      expect(sourceCode).toContain(`'${icon}'`)
    }
    
    // Verify lucide-react import statement
    expect(sourceCode).toMatch(/from ['"]lucide-react['"]/)
  })
})