import { useState, useEffect } from 'react';
import { 
  AddressPurpose, 
  BitcoinNetworkType, 
  request,
  getAddress,
  signTransaction,
  sendBtcTransaction
} from 'sats-connect';

export interface XverseWalletState {
  isConnected: boolean;
  paymentAddress: string | null;
  ordinalsAddress: string | null;
  isConnecting: boolean;
  error: string | null;
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
  });

  // Check if wallet is already connected on mount
  useEffect(() => {
    const savedPaymentAddress = localStorage.getItem('xverse_payment_address');
    const savedOrdinalsAddress = localStorage.getItem('xverse_ordinals_address');
    
    if (savedPaymentAddress && savedOrdinalsAddress) {
      setState(prev => ({
        ...prev,
        isConnected: true,
        paymentAddress: savedPaymentAddress,
        ordinalsAddress: savedOrdinalsAddress,
      }));
    }
  }, []);

  const connectWallet = async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    
    try {
      const response = await getAddress({
        payload: {
          purposes: [AddressPurpose.Payment, AddressPurpose.Ordinals],
          message: 'Connect to sBTC Bridge',
          network: {
            type: BitcoinNetworkType.Signet,
          },
        },
        onFinish: (response) => {
          const paymentAddressItem = response.addresses.find(
            (address) => address.purpose === AddressPurpose.Payment
          );
          const ordinalsAddressItem = response.addresses.find(
            (address) => address.purpose === AddressPurpose.Ordinals
          );

          if (paymentAddressItem && ordinalsAddressItem) {
            // Save to localStorage for persistence
            localStorage.setItem('xverse_payment_address', paymentAddressItem.address);
            localStorage.setItem('xverse_ordinals_address', ordinalsAddressItem.address);

            setState({
              isConnected: true,
              paymentAddress: paymentAddressItem.address,
              ordinalsAddress: ordinalsAddressItem.address,
              isConnecting: false,
              error: null,
            });
          }
        },
        onCancel: () => {
          setState(prev => ({
            ...prev,
            isConnecting: false,
            error: 'Connection cancelled by user',
          }));
        },
      });

    } catch (error: any) {
      console.error('Failed to connect to Xverse wallet:', error);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message || 'Failed to connect to Xverse wallet',
      }));
    }
  };

  const disconnectWallet = () => {
    localStorage.removeItem('xverse_payment_address');
    localStorage.removeItem('xverse_ordinals_address');
    
    setState({
      isConnected: false,
      paymentAddress: null,
      ordinalsAddress: null,
      isConnecting: false,
      error: null,
    });
  };

  const sendBitcoin = async ({ toAddress, amountSats }: SendBitcoinParams): Promise<string> => {
    if (!state.paymentAddress) {
      throw new Error('Wallet not connected');
    }

    const paymentAddress = state.paymentAddress;

    return new Promise((resolve, reject) => {
      let isFinished = false;
      let timeoutId: NodeJS.Timeout | null = null;
      
      try {
        console.log('[Xverse] 🚀 Initiating transaction...');
        console.log('[Xverse] From:', paymentAddress);
        console.log('[Xverse] To:', toAddress);
        console.log('[Xverse] Amount:', amountSats, 'sats');
        
        // Extended timeout: wait 15 seconds for onFinish before falling back
        timeoutId = setTimeout(() => {
          if (!isFinished) {
            isFinished = true;
            console.log('[Xverse] ⏱️ TIMEOUT: onFinish never fired after 15 seconds');
            console.log('[Xverse] 🔄 Falling back to backend detection...');
            resolve('pending');
          }
        }, 15000);
        
        const result = sendBtcTransaction({
          payload: {
            network: {
              type: BitcoinNetworkType.Signet,
            },
            recipients: [
              {
                address: toAddress,
                amountSats: BigInt(amountSats),
              },
            ],
            senderAddress: paymentAddress,
          },
          onFinish: (response: any) => {
            console.log('[Xverse] 🎯 onFinish FIRED!');
            console.log('[Xverse] Response object:', JSON.stringify(response, null, 2));
            
            if (!isFinished) {
              isFinished = true;
              if (timeoutId) clearTimeout(timeoutId);
              
              const txid = response.txid || response.txId || response.transactionId || response.tx;
              
              if (txid) {
                console.log('[Xverse] ✅ Transaction confirmed!');
                console.log('[Xverse] 🔗 TXID:', txid);
                resolve(txid);
              } else {
                console.error('[Xverse] ❌ onFinish fired but no TXID in response:', response);
                resolve('pending');
              }
            } else {
              console.log('[Xverse] ⚠️ onFinish fired but already finished (likely after timeout)');
            }
          },
          onCancel: () => {
            console.log('[Xverse] 🚪 Popup closed by user');
            console.log('[Xverse] 🕐 Waiting for onFinish or timeout...');
          },
        });
        
        console.log('[Xverse] 📤 sendBtcTransaction returned:', result);
        
      } catch (error: any) {
        if (!isFinished) {
          isFinished = true;
          if (timeoutId) clearTimeout(timeoutId);
          console.error('[Xverse] ❌ Send Bitcoin error:', error);
          console.error('[Xverse] Error stack:', error.stack);
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
