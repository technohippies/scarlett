import { createContext, useContext, createSignal, onMount, ParentComponent } from 'solid-js';
import { ethers } from 'ethers';
// import { authService, AuthResult } from '../services/AuthService'; // TODO: AuthService not implemented yet

// TODO: Temporary mock for AuthService
const authService = {
  initialize: async () => {},
  isConnected: () => false,
  getUserAddress: () => null,
  getSigner: () => null,
  connectWithSelector: async () => ({ success: false }),
  disconnect: () => {}
};

interface AuthResult {
  success: boolean;
  address?: string;
}

export interface WalletContextValue {
  isConnected: boolean;
  address: string | null;
  signer: ethers.Signer | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue>(null!);

export const WalletProvider: ParentComponent = (props) => {
  const [isConnected, setIsConnected] = createSignal(false);
  const [address, setAddress] = createSignal<string | null>(null);
  const [signer, setSigner] = createSignal<ethers.Signer | null>(null);

  onMount(async () => {
    await authService.initialize();
    if (authService.isConnected()) {
      setIsConnected(true);
      setAddress(authService.getUserAddress());
      setSigner(authService.getSigner());
    }
  });

  const connect = async () => {
    const result: AuthResult = await authService.connectWithSelector();
    if (result.success) {
      setIsConnected(true);
      setAddress(result.address || null);
      setSigner(authService.getSigner());
    }
  };

  const disconnect = () => {
    authService.disconnect();
    setIsConnected(false);
    setAddress(null);
    setSigner(null);
  };

  return (
    <WalletContext.Provider
      value={{ isConnected: isConnected(), address: address(), signer: signer(), connect, disconnect }}
    >
      {props.children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext); 