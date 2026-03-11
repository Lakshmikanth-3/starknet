import { useState, useEffect } from 'react';
import {
  AddressPurpose,
  BitcoinNetworkType,
  request,
  sendBtcTransaction,
} from 'sats-connect';

export interface XverseWalletState {
  isConnected: boolean;
  paymentAddress: string | null;
  ordinalsAddress: string | null;
  isConnecting: boolean;
  error: string | null;
  isInstalled: boolean | null;
}

export interface SendBitcoinParams {
  toAddress: string;
  amountSats: number;
}

export const useXverseWallet = () => {
  const [state, setState] = useState<XverseWalletState>({
    isConnected: false,
    paymentAddress: null,
    ordinalsAddress: null,
    isConnecting: false,
    error: null,
    isInstalled: null,
  });

  useEffect(() => {
    console.log('[Xverse] Providers on mount → XverseProviders:', !!(window as any).XverseProviders, '| BitcoinProvider:', !!(window as any).BitcoinProvider);
    const timer = setTimeout(() => {
      setState(prev => ({ ...prev, isInstalled: prev.isInstalled ?? true }));
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const connectWallet = async () => {
    console.log('[Xverse] connectWallet() — using request("getAddresses") API');
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    // Safety net: unblock UI if request never settles
    const timeoutId = setTimeout(() => {
      console.log('[Xverse] ⏱️ 25s TIMEOUT - request("getAddresses") never resolved');
      setState(prev => {
        if (!prev.isConnecting) return prev;
        return {
          ...prev,
          isConnecting: false,
          error: 'Connection timed out. Check that Xverse is set to Bitcoin Signet (Settings → Network) and try again.',
        };
      });
    }, 25_000);

    try {
      // Use the modern sats-connect v4 request() API instead of legacy getAddress()
      // This calls provider.request('getAddresses') which handles network mismatches properly
      // Step 1: wallet_connect — establishes the session and shows the Xverse approval popup
      console.log('[Xverse] Step 1: calling wallet_connect...');
      const connectResponse = await request('wallet_connect', {
        message: 'Connect to sBTC Bridge',
        network: BitcoinNetworkType.Signet,
      }) as any;
      console.log('[Xverse] wallet_connect response:', connectResponse);

      if (connectResponse.status !== 'success') {
        clearTimeout(timeoutId);
        const isCancelled = connectResponse.status === 'cancel';
        setState(prev => ({
          ...prev,
          isConnecting: false,
          error: isCancelled
            ? 'Connection cancelled. Click "Connect Xverse Wallet" to try again.'
            : `Connection rejected: ${connectResponse?.error?.message || JSON.stringify(connectResponse)}`,
        }));
        return;
      }

      // Step 2: getAddresses — now that we have a session, fetch the addresses
      console.log('[Xverse] Step 2: calling getAddresses...');
      const response = await request('getAddresses', {
        purposes: [AddressPurpose.Payment, AddressPurpose.Ordinals],
        message: 'Connect to sBTC Bridge',
      }) as any;

      clearTimeout(timeoutId);
      console.log('[Xverse] request("getAddresses") response:', response);

      if (response.status === 'success') {
        const addresses = response.result.addresses;
        const paymentAddr = addresses.find((a: any) => a.purpose === AddressPurpose.Payment || a.purpose === 'payment');
        const ordinalsAddr = addresses.find((a: any) => a.purpose === AddressPurpose.Ordinals || a.purpose === 'ordinals');

        console.log('[Xverse] ✅ Connected! payment:', paymentAddr?.address, 'ordinals:', ordinalsAddr?.address);

        if (paymentAddr) {
          setState({
            isConnected: true,
            paymentAddress: paymentAddr.address,
            ordinalsAddress: ordinalsAddr?.address ?? null,
            isConnecting: false,
            error: null,
            isInstalled: true,
          });
        } else {
          setState(prev => ({
            ...prev,
            isConnecting: false,
            error: 'No payment address returned. Make sure Xverse is on Bitcoin Signet.',
          }));
        }
      } else if (response.status === 'cancel' || response.status === 'error') {
        if (response.status === 'cancel') {
          console.log('[Xverse] User cancelled connect');
          setState(prev => ({
            ...prev,
            isConnecting: false,
            error: 'Connection cancelled. Click "Connect Xverse Wallet" to try again.',
          }));
          return;
        }
        // status === 'error'
      } else {
        // Handle specific error codes
        const errCode = (response as any)?.error?.code;
        const errMsg = (response as any)?.error?.message || '';
        console.error('[Xverse] Error response:', response, 'code:', errCode);

        let userMessage = `Wallet error: ${errMsg}`;

        if (errCode === -32002 || errMsg.toLowerCase().includes('access denied')) {
          userMessage = 'ACCESS DENIED: Xverse has blocked this site. Fix: Open Xverse → Settings → Connected Sites → remove localhost:3000 → hard refresh this page (Cmd+Shift+R) → try again.';
        } else if (errCode === -32603 || errMsg.toLowerCase().includes('internal')) {
          userMessage = 'Xverse internal error. Try reloading the Xverse extension from brave://extensions and hard refreshing this page.';
        }

        setState(prev => ({
          ...prev,
          isConnecting: false,
          error: userMessage,
        }));
      }

    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('[Xverse] ❌ request("getAddresses") threw:', error?.message, error);
      const msg: string = error?.message || 'Failed to connect to Xverse wallet';
      const notInstalled =
        msg.toLowerCase().includes('no bitcoin wallet') ||
        msg.toLowerCase().includes('not installed') ||
        msg.toLowerCase().includes('no wallet');
      setState(prev => ({
        ...prev,
        isConnecting: false,
        isInstalled: notInstalled ? false : prev.isInstalled,
        error: notInstalled
          ? 'Xverse extension not found. Please install Xverse and refresh the page.'
          : msg,
      }));
    }
  };

  const disconnectWallet = () => {
    setState(prev => ({
      ...prev,
      isConnected: false,
      paymentAddress: null,
      ordinalsAddress: null,
      isConnecting: false,
      error: null,
    }));
  };

  const sendBitcoin = async ({ toAddress, amountSats }: SendBitcoinParams): Promise<string> => {
    if (!state.paymentAddress) throw new Error('Wallet not connected');
    const paymentAddress = state.paymentAddress;

    return new Promise((resolve, reject) => {
      let isFinished = false;
      let timeoutId: NodeJS.Timeout | null = null;

      try {
        console.log('[Xverse] 🚀 sendBitcoin:', amountSats, 'sats →', toAddress);

        timeoutId = setTimeout(() => {
          if (!isFinished) {
            isFinished = true;
            console.log('[Xverse] ⏱️ sendBitcoin timeout — falling back to polling');
            resolve('pending');
          }
        }, 15_000);

        sendBtcTransaction({
          payload: {
            network: { type: BitcoinNetworkType.Signet },
            recipients: [{ address: toAddress, amountSats: BigInt(amountSats) }],
            senderAddress: paymentAddress,
          },
          onFinish: (response: any) => {
            console.log('[Xverse] 🎯 sendBtcTransaction onFinish:', response);
            if (!isFinished) {
              isFinished = true;
              if (timeoutId) clearTimeout(timeoutId);
              const txid = response.txid || response.txId || response.transactionId || response.tx;
              console.log('[Xverse] TXID:', txid);
              txid ? resolve(txid) : resolve('pending');
            }
          },
          onCancel: () => {
            console.log('[Xverse] 🚪 sendBtcTransaction cancelled by user');
            if (!isFinished) {
              isFinished = true;
              if (timeoutId) clearTimeout(timeoutId);
              reject(new Error('Transaction cancelled by user'));
            }
          },
        });
      } catch (error: any) {
        if (!isFinished) {
          isFinished = true;
          if (timeoutId) clearTimeout(timeoutId);
          console.error('[Xverse] ❌ sendBitcoin error:', error);
          reject(error);
        }
      }
    });
  };

  return {
    ...state,
    connectWallet,
    disconnectWallet,
    sendBitcoin,
  };
};
