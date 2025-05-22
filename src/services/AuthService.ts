import { ethers } from "ethers";
import { initSilk } from "@silk-wallet/silk-wallet-sdk";

// Define the expected structure of the Silk provider instance
interface SilkProvider {
  login: () => Promise<void>;
  loginSelector: (ethereum?: any) => Promise<string | null>;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  isSilk?: boolean;
}

// Result type for connect operations
export interface AuthResult {
  success: boolean;
  address?: string;
  error?: string;
}

// Extend the Window interface to recognize Silk
declare global {
  interface Window {
    ethereum?: ethers.providers.ExternalProvider & SilkProvider;
    silk?: SilkProvider;
  }
}

class AuthService {
  private provider: ethers.providers.Web3Provider | null = null;
  private signer: ethers.Signer | null = null;
  private userAddress: string | null = null;
  private isAuthenticated: boolean = false;
  private silkProvider: SilkProvider | null = null;
  private initializationPromise: Promise<void> | null = null;
  private _isInitialized: boolean = false;

  initialize(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = this._initialize();
    }
    return this.initializationPromise;
  }

  private async _initialize(): Promise<void> {
    if (this._isInitialized) return;
    try {
      this.silkProvider = initSilk() as unknown as SilkProvider;
      if (typeof window !== 'undefined') window.silk = this.silkProvider;
      await this.checkForExistingConnection();
    } catch (err) {
      console.error('AuthService initialization error:', err);
    } finally {
      this._isInitialized = true;
    }
  }

  private async checkForExistingConnection(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (window.ethereum && !window.ethereum.isSilk) {
      try {
        const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
        const accounts = await web3Provider.send('eth_accounts', []);
        if (accounts.length > 0) {
          this.provider = web3Provider;
          this.signer = this.provider.getSigner();
          this.userAddress = await this.signer.getAddress();
          this.isAuthenticated = true;
          return;
        }
      } catch (e) {
        console.error('Error checking injected accounts:', e);
      }
    }
  }

  isInitialized(): boolean { return this._isInitialized; }
  isConnected(): boolean { return this.isAuthenticated && !!this.userAddress; }
  getUserAddress(): string | null { return this.userAddress; }
  getSigner(): ethers.Signer | null { return this.signer; }

  async connectWithSelector(): Promise<AuthResult> {
    if (!this._isInitialized || !this.silkProvider) {
      return { success: false, error: 'AuthService not ready' };
    }
    try {
      const selection = await this.silkProvider.loginSelector(window.ethereum);
      let active: any;
      if (selection === 'silk') active = this.silkProvider;
      else if (selection === 'injected' && window.ethereum) active = window.ethereum;
      else return { success: false, error: 'No wallet selected' };
      this.provider = new ethers.providers.Web3Provider(active);
      const accounts = await this.provider.send('eth_requestAccounts', []);
      if (!accounts || accounts.length === 0) throw new Error('No accounts');
      this.signer = this.provider.getSigner();
      this.userAddress = await this.signer.getAddress();
      this.isAuthenticated = true;
      return { success: true, address: this.userAddress };
    } catch (error: any) {
      this.isAuthenticated = false;
      return { success: false, error: error.message || 'Connection failed' };
    }
  }

  disconnect(): void {
    this.provider = null;
    this.signer = null;
    this.userAddress = null;
    this.isAuthenticated = false;
  }
}

export const authService = new AuthService(); 