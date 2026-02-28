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

    return new Promise((resolve, reject) => {
      let isFinished = false;
      let popupClosed = false;
      
      // Timeout after 60 seconds if no response
      const timeoutId = setTimeout(() => {
        if (!isFinished) {
          console.log('[Xverse] ⏱️ Transaction timeout - no response received');
          reject(new Error('Transaction timeout - please try again'));
        }
      }, 60000); // 60 seconds
      
      try {
        console.log('[Xverse] 🚀 Initiating transaction...');
        console.log('[Xverse] From:', state.paymentAddress);
        console.log('[Xverse] To:', toAddress);
        console.log('[Xverse] Amount:', amountSats, 'sats');
        
        sendBtcTransaction({
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
            senderAddress: state.paymentAddress,
          },
          onFinish: (response) => {
            if (!isFinished) {
              isFinished = true;
              clearTimeout(timeoutId);
              console.log('[Xverse] ✅ Transaction confirmed!');
              console.log('[Xverse] 🔗 TXID:', response.txid);
              resolve(response.txid);
            }
          },
          onCancel: () => {
            popupClosed = true;
            console.log('[Xverse] ℹ️ Popup closed by user');
            
            // If popup closed without onFinish, wait 3 seconds then check
            setTimeout(() => {
              if (!isFinished) {
                clearTimeout(timeoutId);
                console.log('[Xverse] ❌ Transaction cancelled - popup closed without confirmation');
                reject(new Error('Transaction cancelled'));
              } else {
                console.log('[Xverse] ✅ Popup closed AFTER confirmation (transaction successful)');
              }
            }, 3000); // Wait 3 seconds for onFinish to fire
          },
        });
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('[Xverse] ❌ Send Bitcoin error:', error);
        reject(error);
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
