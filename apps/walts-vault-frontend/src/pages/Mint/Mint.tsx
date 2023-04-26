import { ReactComponent as BrokenPencilBlack } from 'assets/icons/ic-broken-pencil-black.svg';
import { ReactComponent as Delimeter } from 'assets/icons/ic-delimeter.svg';
import { ReactComponent as EnterDecorationBlack } from 'assets/icons/ic-enter-decoration-black.svg';
import { ReactComponent as PaintbrushBlack } from 'assets/icons/ic-paintbrush-black.svg';
import { ReactComponent as Palette } from 'assets/icons/ic-palette.svg';
import { ReactComponent as MintErrorBackdrop } from 'assets/images/backdrops/img-mint-error-backdrop.svg';
import { ReactComponent as MintNumber2Backdrop } from 'assets/images/backdrops/img-mint-number-2-backdrop.svg';
import { ReactComponent as MintNumberBackdrop } from 'assets/images/backdrops/img-mint-number-backdrop.svg';
import { ReactComponent as MintTotalBackdrop } from 'assets/images/backdrops/img-mint-total-backdrop.svg';
import { ReactComponent as MintTotalBigBackdrop } from 'assets/images/backdrops/img-mint-total-big-backdrop.svg';
import EllipseGradient from 'assets/images/img-ellipse-gradient.png';
import BG_VIDEO from 'assets/videos/WV-bg-team.mp4';
import Footer from 'components/Footer';
import Menu from 'components/Menu';
import { useEffect, useState } from 'react';
import { useMetaMask } from 'metamask-react';
import config from '../../web3/config.json';

import {
  getClaimedRefund,
  getIsApproved,
  getMintPrice,
  getRavendaleTokens,
  getResSpotFCFS,
  getResSpotVL,
  getState,
  getUsedResFCFS,
  getUsedResVL,
  placeOrder,
  providerHandler,
  refund,
  setApproval,
} from '../../web3/contractInteraction';
import { getOrderSignature, getRefundSignature } from '../../utils/backendApi';
import Counter from 'components/Counter/Counter';

export default function Home() {
  const { connect, account, status, chainId } = useMetaMask();

  // UI States
  const [step, setStep] = useState(0);
  const [step0Status, setStep0Status] = useState('initial'); // initial loading error completed
  const [step1Status, setStep1Status] = useState('initial'); // initial loading error completed
  const [errorMessage, setErrorMessage] = useState('Hmmm, something went wrong');

  // Mint Logic States
  const [signature, setSignature] = useState({ order: [], refund: [] });
  const [mintState, setMintState] = useState('NOT_LIVE');

  const [ravendaleTokens, setRavendaleTokens] = useState<{ tokenId: number, locked: boolean }[]>([]);
  const [isApproved, setIsApproved] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState<number[]>([]);

  const [vaultData, setVaultData] = useState({ allocatedSpots: 0, reservationPerSpot: 0, usedReservations: 0 });
  const [vaultAmount, setVaultAmount] = useState(0);
  const [maxVaultMint, setMaxVaultMint] = useState(0);

  const [maxFCFSMint, setMaxFCFSMint] = useState(0);
  const [FCFSAmount, setFCFSAmount] = useState(0);

  const [mintPrice, setMintPrice] = useState('');

  function renderError(title: string, subTitle: string) {
    return (
      <div className='flex flex-col items-center'>
        <BrokenPencilBlack />
        <br />
        <h3 className='text-h2 whitespace-nowrap'>{title}</h3>
        <div className='relative flex items-center text-center w-[800px]'>
          <MintErrorBackdrop className='max-w-[100vw] mx-auto' />
          <h2 className='absolute top-[5px] w-[100%] text-h2 text-white whitespace-nowrap mx-auto'>{subTitle}</h2>
        </div>
      </div>
    );
  }

  function renderLoading(subTitle: string) {
    return (
      <div className='flex items-center'>
        <PaintbrushBlack />
        <h3 className='text-h3 ml-[5%] whitespace-nowrap'>{subTitle}</h3>
      </div>
    );
  }

  const handleChainChange = async () => {
    const chainID = config.chainID;
    if (chainId !== null && chainId !== `0x${chainID}`) {
      setStep(0);
      setStep0Status('loading');
      await window.ethereum
        .request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${chainID}` }],
        })
        .then(() => {
          setStep(1);
          setStep0Status('completed');
        });
    } else {
    }
  };

  useEffect(() => {
    if (chainId) handleChainChange();
  }, [chainId]);

  async function connectWallet() {
    setStep0Status('loading');

    try {
      await connect();
    } catch (e) {
      setStep0Status('error');
      setTimeout(() => {
        setStep0Status('initial');
      });
    }
  }

  const toggleSelect = (tokenId: number) => {
    if (selectedTokens.includes(tokenId)) {
      setSelectedTokens(selectedTokens.filter((token) => token !== tokenId));
    } else {
      setSelectedTokens([...selectedTokens, tokenId]);
    }
  };

  const getMaxVaultMint = () => {
    // X1
    const selectedRD = selectedTokens.length;

    // X2
    const lockedTokens = ravendaleTokens?.filter(token => token.locked === true).length;

    const totalAllocatedSpots = selectedRD + lockedTokens + vaultData.allocatedSpots;
    const maxReservations = totalAllocatedSpots * vaultData.reservationPerSpot;
    const maxMint = maxReservations - vaultData.usedReservations;

    setMaxVaultMint(maxMint);
  };

  useEffect(() => {
    getMaxVaultMint();
  }, [selectedTokens, vaultData]);

  const updateAccount = async () => {
    // Get Mint State
    const state = await getState();
    setMintState(state);

    // Get Ravendale Data
    const ravendale = await getRavendaleTokens(account || '');
    setRavendaleTokens(ravendale);

    // Get Vault List Mint Data

    // X5
    const usedReservationsVL = await getUsedResVL(account || '');
    setVaultData({ ...vaultData, usedReservations: usedReservationsVL });

    // Get FCFS Mint Data
    // G1
    const reservationPerUser = await getResSpotFCFS();
    // G2
    const usedReservationsFCFS = await getUsedResFCFS(account || '');

    setMaxFCFSMint(reservationPerUser - usedReservationsFCFS);

    setFCFSAmount(0);
    setVaultAmount(0);
    setSelectedTokens([]);
  };

  const approvalHandler = async () => {
    setStep1Status('loading');
    try {
      await setApproval();

      const approval = await getIsApproved(account || '');
      setIsApproved(approval);

    } catch (e) {
      console.log('Approval Error', e);
    }
    setStep1Status('initial');
  };

  const mintHandler = async () => {
    if ((selectedTokens.length + vaultAmount + FCFSAmount) > 0)
      try {
        setStep1Status('loading');
        await placeOrder(
          account,
          Number(mintPrice),
          selectedTokens,
          signature.order,
          mintState === 'LIVE' ? vaultAmount : 0,
          mintState === 'LIVE' ? FCFSAmount : 0,
        );
        await updateAccount();
        setStep1Status('completed');
      } catch (e: any) {
        console.log(e);

        setErrorMessage(
          e.code === 'INSUFFICIENT_FUNDS'
            ? 'Wallet does not have enough balance'
            : e.code === 'ACTION_REJECTED'
            ? 'Transaction Rejected'
            : 'Hmmm, something went wrong',
        );

        setStep1Status('error');
        setTimeout(() => {
          setStep1Status('initial');
        }, 5000);
      }
    else console.log('Nothing to Mint!');
  };

  useEffect(() => {
    if (account) accountSetup();
  }, [account]);

  // Show Connect Wallet Screen 
  // If user disconnects
  useEffect(() => {
    if (status === 'notConnected' || status === 'unavailable') {
      setStep(0);
      setStep0Status('initial');
    }
  });

  const accountSetup = async () => {
    setStep(0);
    setStep0Status('loading');
    await providerHandler();

    // Get User Signature form API
    const orderSignature = await getOrderSignature(account);
    const refundSignature = await getRefundSignature(account);
    setSignature({
      order: orderSignature.signature,
      refund: refundSignature.signature,
    });

    // Get Mint State
    const state = await getState();
    setMintState(state);

    // Get Ravendale Data
    const ravendale = await getRavendaleTokens(account || '');
    setRavendaleTokens(ravendale);

    // Check approval
    if (ravendale.length > 0) {
      const approval = await getIsApproved(account || '');
      setIsApproved(approval);
    } else {
      setIsApproved(true);
    }

    // Get Vault List Mint Data
    // X3
    const allocatedSpots = orderSignature ? orderSignature.spots.spotsOne : 0;
    // X4
    const reservationPerSpot = await getResSpotVL();
    // X5
    const usedReservationsVL = await getUsedResVL(account || '');

    setVaultData({
      allocatedSpots: allocatedSpots,
      reservationPerSpot: reservationPerSpot,
      usedReservations: usedReservationsVL,
    });

    // Get FCFS Mint Data
    // G1
    const reservationPerUser = await getResSpotFCFS();
    // G2
    const usedReservationsFCFS = await getUsedResFCFS(account || '');

    setMaxFCFSMint(reservationPerUser - usedReservationsFCFS);

    // Get Mint Price
    const price = await getMintPrice();
    setMintPrice(price);

    setStep(1);
    setStep0Status('completed');
  };

  function renderStep0() {
    if (step0Status === 'error') {
      return renderError('Hmmm, something went wrong', 'Error: Unable to Connect');
    }
    if (step0Status === 'loading') {
      return renderLoading('Connecting Wallet...');
    }
    return (
      <>
        <div className='flex items-center'>
          <EnterDecorationBlack />
          <button className='px-10' type='button' onClick={connectWallet}>
            <h1 className='text-black'>Connect</h1>
          </button>
          <EnterDecorationBlack className='rotate-180' />
        </div>
        <h3 className='text-h4 mt-[-2%]'>Follow Your Dreams</h3>
      </>
    );
  }

  function renderStep1() {
    if (step1Status === 'error') {
      return renderError(errorMessage, 'Please Try Again');
    }
    if (step1Status === 'loading') {
      return renderLoading('In Progress...');
    }
    if (step1Status === 'completed') {
      return (
        <div className='flex flex-col items-center'>
          <Palette />
          <br />
          <h3 className='text-h2 whitespace-nowrap'>Congrats Dreamer!</h3>
          <div className='relative flex items-center text-center w-[800px]'>
            <MintTotalBigBackdrop className='mx-auto' />
            <h2 className='absolute top-[5px] w-[100%] text-h2 text-white whitespace-nowrap mx-auto'>
              Successfully Reserved
            </h2>
          </div>
        </div>
      );
    }
    return (
      <div className='flex flex-col select-none'>
        {/* Ravendale Section */}
        {ravendaleTokens.length > 0 &&
        <>
          <div className='flex row justify-between'>
            <div className='flex flex-col'>
              <span className='text-[42px]'>Ravendale</span>
              <span className='text-[20px] mt-[-16px]'>Select Tokens from Wallet</span>
            </div>
            <div className='scrollbar-hide grid grid-cols-5 gap-4 self-center max-h-[86px] overflow-y-auto'>
              {ravendaleTokens.map(token => (
                <div
                  key={token.tokenId}
                  className={`
                      w-[43px] h-[43px] flex items-center justify-center cursor-pointer
                      ${selectedTokens.includes(token.tokenId) ? 'border-2 border-black' : 'border border-gray-400'}
                    `}
                  onClick={() => {
                    if (!token.locked) toggleSelect(token.tokenId);
                  }}
                >
                  <span className={`text-[20px] ${token.locked && 'text-[gray]'}`}>{token.tokenId}</span>
                </div>
              ))}
            </div>
          </div>
          <Delimeter className='my-[16px]' />
        </>
        }
        <div className={`flex row items-center justify-between ${maxVaultMint <= 0 && 'disabled'}`}>
          <div className='flex flex-col'>
            <span className='text-[42px]'>Vault List</span>
            <span className='text-[20px] mt-[-16px]'>available: {maxVaultMint}</span>
          </div>
          <Counter
            style={0}
            maxCount={maxVaultMint}
            count={vaultAmount}
            setCount={setVaultAmount}
          />
        </div>
        <Delimeter className='my-[16px]' />
        <div className={`flex row items-center justify-between ${maxFCFSMint <= 0 && 'disabled'}`}>
          <div className='flex flex-col'>
            <span className='text-[42px]'>FCFS</span>
            <span className='text-[20px] mt-[-16px]'>available: {maxFCFSMint}</span>
          </div>
          <Counter
            style={1}
            maxCount={maxFCFSMint}
            count={FCFSAmount}
            setCount={setFCFSAmount}
          />
        </div>
        <Delimeter className='my-[16px]' />
        <div className='flex flex-col items-center mx-auto mt-[16px] relative'>
          <MintTotalBackdrop className='absolute z-0' />
          <div className='text-[20px] text-white leading-[47px] mx-auto mt-[-11px] z-10'>
            no. of mints: {selectedTokens.length + vaultAmount + FCFSAmount}
          </div>
          <div
            className='text-[32px] text-white leading-[47px] mx-auto mt-[-27px] z-10'>Price: {((vaultAmount + FCFSAmount) * Number(mintPrice)).toFixed(2)} eth
          </div>
        </div>
        <div className='flex flex-col items-center'>
          <div
            className={`flex flex-row items-center ${isApproved && (selectedTokens.length + vaultAmount + FCFSAmount) <= 0 && 'disabled'}`}>
            <EnterDecorationBlack className='w-[33px]' />
            <button className='px-3' type='button' onClick={() => {
              if (isApproved) mintHandler();
              else approvalHandler();
            }}>
              <h1 className='text-black text-[64px]'>{isApproved ? 'Confirm' : 'Approve'}</h1>
            </button>
            <EnterDecorationBlack className='rotate-180 w-[33px]' />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='h-screen w-screen flex items-center justify-center'>
      <img className='absolute m-auto min-w-[1200px]' src={EllipseGradient} alt='ellipse' />
      <video autoPlay className='w-full h-full object-cover object-center' loop muted playsInline>
        <source src={BG_VIDEO} type='video/mp4' />
      </video>
      <Menu />
      <div className='cover flex flex-col justify-center items-center'>
        {step === 0 ? renderStep0() : renderStep1()}
      </div>
      <Footer />
    </div>
  );
}
