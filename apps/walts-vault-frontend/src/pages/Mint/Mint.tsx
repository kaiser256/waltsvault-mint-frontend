import { ReactComponent as BrokenPencilBlack } from 'assets/icons/ic-broken-pencil-black.svg';
import { ReactComponent as Delimeter } from 'assets/icons/ic-delimeter.svg';
import { ReactComponent as EnterDecorationBlack } from 'assets/icons/ic-enter-decoration-black.svg';
import { ReactComponent as PaintbrushBlack } from 'assets/icons/ic-paintbrush-black.svg';
import { ReactComponent as Palette } from 'assets/icons/ic-palette.svg';
import { ReactComponent as MintErrorBackdrop } from 'assets/images/backdrops/img-mint-error-backdrop.svg';
import { ReactComponent as MintTotalBackdrop } from 'assets/images/backdrops/img-mint-total-backdrop.svg';
import { ReactComponent as MintTotalBigBackdrop } from 'assets/images/backdrops/img-mint-total-big-backdrop.svg';
import EllipseGradient from 'assets/images/img-ellipse-gradient.png';
import BG_VIDEO from 'assets/videos/WV-bg-team.mp4';
import Footer from 'components/Footer';
import Menu from 'components/Menu';
import { useEffect, useState } from 'react';
import config from '../../web3/config.json';
import { useAccount, useNetwork, useSwitchNetwork, useSigner, useProvider } from 'wagmi';
import { useWeb3Modal } from '@web3modal/react';

import {
  getAmountSold,
  getIsApproved,
  getMaxAmountForSale,
  getMintPrice,
  getMintTime,
  getMintsPerRD,
  getRavendaleTokens,
  getResSpotFCFS,
  getResSpotVL,
  getUsedResFCFS,
  getUsedResVL,
  placeOrder,
  providerHandler,
  setApproval,
} from '../../web3/contractInteraction';
import { getOrderSignature, getRefundSignature } from '../../utils/backendApi';
import Counter from 'components/Counter/Counter';

export default function Home() {
  const { isConnected, address, status } = useAccount();
  const { open } = useWeb3Modal();
  const { chain } = useNetwork();
  const { switchNetwork } = useSwitchNetwork()
  const { data } = useSigner()
  const provider = useProvider()

  // UI States
  const [step, setStep] = useState(0);
  const [step0Status, setStep0Status] = useState('initial'); // initial loading error completed
  const [step1Status, setStep1Status] = useState('initial'); // initial loading error completed
  const [errorMessage, setErrorMessage] = useState('Hmmm, something went wrong');
  const [successMessage, setSuccessMessage] = useState('Successfully Minted')

  // Mint Logic States
  const [mintState, setMintState] = useState('NOT_LIVE');
  const [signature, setSignature] = useState<any>();

  const [ravendaleTokens, setRavendaleTokens] = useState<{ tokenId: number, locked: boolean }[]>([]);
  const [isApproved, setIsApproved] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState<number[]>([]);

  const [vaultData, setVaultData] = useState({ mintsPerRD: 0, allocatedSpots: 0, reservationPerSpot: 0, usedReservations: 0 });
  const [vaultAmount, setVaultAmount] = useState(0);
  const [maxVaultMint, setMaxVaultMint] = useState(0);

  const [maxFCFSMint, setMaxFCFSMint] = useState(0);
  const [FCFSAmount, setFCFSAmount] = useState(0);

  const [mintPrice, setMintPrice] = useState('');
  const [availableSupply, setAvailableSupply] = useState<number>(0);

  function renderError(title: string, subTitle: string) {
    return (
      <div className="flex flex-col items-center max-w-[90vw] animation">
        <BrokenPencilBlack />
        <br />
        <h3 className="text-[20px] md:text-[40px] whitespace-nowrap">{title}</h3>
        <div className="max-w-[100%] relative flex items-center text-center w-[800px]">
          <MintErrorBackdrop className="max-w-[100vw] mx-auto" />
          <h2
            className="absolute top-[5px] w-[100%] text-[30px] md:text-[64px] text-white whitespace-nowrap mx-auto">{subTitle}</h2>
        </div>
      </div>
    );
  }

  function renderLoading(subTitle: string, isLoading: boolean, width: string) {
    return (
      <div className="flex flex-col md:flex-row gap-4 items-center animation">
        <PaintbrushBlack />
        <h3
          className={`${width} text-h3 whitespace-nowrap ${isLoading && 'loading'}`}>{subTitle}</h3>
      </div>
    );
  }

  const handleChainChange = async () => {
    const chainID = config.chainID;
    if (chain !== undefined && chain.id !== chainID) {
      setStep(0);
      setStep0Status('loading');
      await switchNetwork?.(chain.id)
    } else {
      setStep(1);
      setStep0Status('completed');
    }
  };

  useEffect(() => {
    if (chain) handleChainChange();
  }, [chain]);

  async function connectWallet() {
    setStep0Status('loading');

    try {
      await open();
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
    const selectedRD = selectedTokens.length;

    const totalAllocatedSpots = selectedRD * vaultData.mintsPerRD + vaultData.allocatedSpots * vaultData.reservationPerSpot;
    const maxMint = totalAllocatedSpots - vaultData.usedReservations;
    if (maxMint < vaultAmount) {
      setVaultAmount(0)
    } else {
      setMaxVaultMint(maxMint);
    }
  };

  useEffect(() => {
    getMaxVaultMint();
  }, [selectedTokens, vaultData]);


  const mintHandler = async () => {
      try {
        setStep1Status('loading');
        if (!isApproved) {
          await setApproval();

          const approval = await getIsApproved(address || '');
          setIsApproved(approval);
          setSuccessMessage('Successfully Approved');
        }
        if ((mintState !== 'NOT_LIVE') && (selectedTokens.length || vaultAmount || FCFSAmount)) {
          await placeOrder(
            address,
            Number(mintPrice),
            selectedTokens,
            signature,
            mintState === 'LIVE' ? Math.min(selectedTokens.length, vaultAmount) : 0,
            mintState === 'LIVE' ? Math.max(vaultAmount - selectedTokens.length, 0) : 0,
            mintState === 'PUBLIC' ? FCFSAmount : 0,
          );
          setSuccessMessage('Successfully Minted');
        }
        await updateAccount();
        setStep1Status('completed');
        if (mintState === 'NOT_LIVE') {
          setTimeout(() => {
            setStep1Status('initial');
          }, 3000);
        }
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
        }, 3000);
      }
  };

  useEffect(() => {
    if (address && data) accountSetup();
  }, [address, data]);

  // Show Connect Wallet Screen
  // If user disconnects
  useEffect(() => {
    if (!isConnected) {
      setStep(0);
      setStep0Status('initial');
    }
  });

  const checkMintState = async () => {
    const mintTimes = await getMintTime();
    const currentTime = Number(Date.now() / 1000);

    if (currentTime < mintTimes.START_RD) {
      setMintState('NOT_LIVE');
      console.log('MINT_STATE: NOT_LIVE');
    }
    else if (currentTime >= mintTimes.START_RD && currentTime < mintTimes.END_RD) {
      setMintState('LIVE');
      console.log('MINT_STATE: LIVE');
    }
    else {
      setMintState('PUBLIC');
      console.log('MINT_STATE: PUBLIC');
    }

    // setMintState('PUBLIC')
  }

  const updateAccount = async () => {
    await checkMintState();

    // Get Ravendale Data
    const ravendale = await getRavendaleTokens(address || '');
    setRavendaleTokens(ravendale);
    
    // Get Vault List Mint Data
    const usedReservationsVL = await getUsedResVL(address || '');
    setVaultData({ ...vaultData, usedReservations: usedReservationsVL });

    // Get FCFS Mint Data
    const reservationPerUser = await getResSpotFCFS();
    const usedReservationsFCFS = await getUsedResFCFS(address || '');
    setMaxFCFSMint(reservationPerUser - usedReservationsFCFS);

    // Get Available Supply
    const maxSupply = await getMaxAmountForSale();
    const amountSold = await getAmountSold();
    setAvailableSupply(maxSupply - amountSold);

    setFCFSAmount(0);
    setVaultAmount(0);
    setSelectedTokens([]);
  };

  const accountSetup = async () => {
    setStep(0);
    setStep0Status('loading');
    if (data) {
      await providerHandler(data, provider);
    }

    // Get User Signature form API
    const orderSignature = await getOrderSignature(address);
    setSignature(orderSignature.signature);

    await checkMintState();

    // Get Ravendale Data
    const ravendale = await getRavendaleTokens(address || '');
    setRavendaleTokens(ravendale);

    // Check approval
    if (ravendale.length > 0) {
      const approval = await getIsApproved(address || '');
      setIsApproved(approval);
    } else {
      setIsApproved(true);
    }

    // Get Vault List + Ravendale Mint Data
    const allocatedSpots = orderSignature ? orderSignature.spots.spotsOne : 0;
    
    const mintsPerRDToken = await getMintsPerRD();
    
    const reservationPerSpot = await getResSpotVL();
    
    const usedReservationsVL = await getUsedResVL(address || '');

    setVaultData({
      mintsPerRD: mintsPerRDToken,
      allocatedSpots: allocatedSpots,
      reservationPerSpot: reservationPerSpot,
      usedReservations: usedReservationsVL,
    });

    // Get FCFS Mint Data
    
    const reservationPerUser = await getResSpotFCFS();
    
    const usedReservationsFCFS = await getUsedResFCFS(address || '');

    setMaxFCFSMint(reservationPerUser - usedReservationsFCFS);

    // Get Mint Price
    const price = await getMintPrice();
    setMintPrice(price);

    // Get Available Supply
    const maxSupply = await getMaxAmountForSale();
    const amountSold = await getAmountSold();
    // setAvailableSupply(maxSupply - amountSold);
    setAvailableSupply(0);

    setVaultAmount(0)
    setFCFSAmount(0)
    setSelectedTokens([])
    setStep(1);
    setStep0Status('completed');
  };

  function renderStep0() {
    if (step0Status === 'error') {
      return renderError('Hmmm, something went wrong', 'Error: Unable to Connect');
    }
    if (step0Status === 'loading') {
      if (chain !== undefined && chain.id !== config.chainID) {
        return renderLoading('Switch to Ethereum Mainnet', false, 'chain');
      } else {
        return renderLoading('Connecting Wallet', true, 'connect');
      }
    }
    return (
      <>
        <div className="flex items-center animation">
          <EnterDecorationBlack />
          <button className="px-10" type="button" onClick={connectWallet}>
            <h1 className="text-black">Connect</h1>
          </button>
          <EnterDecorationBlack className="rotate-180" />
        </div>
        <h3 className="text-h4 mt-[-2%]">Follow Your Dreams</h3>
      </>
    );
  }

  function renderStep1() {
    if (step1Status === 'error') {
      return renderError(errorMessage, 'Please Try Again');
    }
    if (step1Status === 'loading') {
      return renderLoading('In Progress', true, 'progress');
    }
    if (step1Status === 'completed') {
      return (
        <div className="flex flex-col items-center max-w-[90vw] animation">
          <Palette />
          <br />
          <h3 className="text-[20px] md:text-[40px] whitespace-nowrap">Congrats Dreamer!</h3>
          <div className="max-w-[100%] relative flex items-center text-center w-[800px]">
            <MintTotalBigBackdrop className="mx-auto" />
            <h2 className="absolute top-[5px] w-[100%] text-[38px] md:text-[64px] text-white whitespace-nowrap mx-auto">
              {successMessage}
            </h2>
          </div>
        </div>
      );
    }
  if (ravendaleTokens.length > 0 || (availableSupply > 0 && (maxVaultMint > 0 || (maxFCFSMint > 0 && mintState === 'PUBLIC'))))
    return (
      <div className="flex flex-col select-none max-w-[90vw] animation">
        {/* Ravendale Section */}
        {ravendaleTokens.length > 0 &&
          <>
            <div className="flex flex-col md:flex-row justify-start md:justify-between">
              <div className={`flex flex-col ${mintState === 'NOT_LIVE' && 'disabled'}`}>
                <span className="text-[42px]">Ravendale</span>
                <span className="text-[20px] mt-[-16px]">Select Tokens from Wallet</span>
              </div>
              <div
                className="w-[280px] scrollbar-hide flex flex-wrap gap-[12px] md:self-center max-h-[102px] overflow-y-auto">
                {ravendaleTokens.map(token => (
                  <div
                    key={token.tokenId}
                    className={`
                      w-[43px] h-[43px] flex items-center justify-center cursor-pointer
                      ${selectedTokens.includes(token.tokenId) ? 'border-2 border-black' : (token.locked || mintState === 'NOT_LIVE') ? 'border border-gray-400 border-opacity-50' : 'border border-gray-400 '} 
                      ${selectedTokens.includes(token.tokenId) || token.locked ? '' : 'hover'}
                    `}
                    onClick={() => {
                      if (!token.locked && mintState !== 'NOT_LIVE') toggleSelect(token.tokenId);
                    }}
                  >
                    <span
                      className={`text-[20px] ${(token.locked || mintState === 'NOT_LIVE') && 'text-[gray] text-opacity-50'}`}>{token.tokenId}</span>
                  </div>
                ))}
              </div>
            </div>
            <Delimeter className="max-w-[100%] my-[16px]" />
          </>
        }

        {/* Vault List Section */}
        {(mintState !== 'PUBLIC' && availableSupply > 0) && 
          <>
            <div
              className={`flex row items-center justify-between ${(mintState === 'NOT_LIVE' || maxVaultMint <= 0) && 'disabled'}`}>
              <div className="flex flex-col">
                <span className="text-[42px]">Vault List</span>
                <span className="text-[20px] mt-[-16px]">available: {Math.min(maxVaultMint, availableSupply)}</span>
              </div>
              <Counter
                style={0}
                maxCount={Math.min(maxVaultMint, availableSupply)}
                count={vaultAmount}
                setCount={setVaultAmount}
              />
            </div>
            <Delimeter className="max-w-[100%] my-[16px]" />
          </>
        }

        {/* Public Sale Section */}
        {(mintState === 'PUBLIC' && availableSupply > 0) &&
          <>
            <div
              className={`flex row items-center justify-between`}>
              <div className="flex flex-col">
                <span className="text-[42px]">FCFS</span>
                <span className="text-[20px] mt-[-16px]">available: {Math.min(maxFCFSMint, availableSupply)}</span>
              </div>
              <Counter
                style={1}
                maxCount={Math.min(maxFCFSMint, availableSupply)}
                count={FCFSAmount}
                setCount={setFCFSAmount}
              />
            </div>
            <Delimeter className="max-w-[100%] my-[16px]" />  
          </>
        }
        <div className="flex flex-col items-center mx-auto mt-[16px] relative">
          <MintTotalBackdrop className="absolute z-0" />
          <div className="text-[20px] text-white leading-[47px] mx-auto mt-[-11px] z-10">
            no. of mints: {selectedTokens.length + vaultAmount + FCFSAmount}
          </div>
          <div
            className="text-[32px] text-white leading-[47px] mx-auto mt-[-27px] z-10">Price: {parseFloat(((vaultAmount + FCFSAmount) * Number(mintPrice)).toFixed(5))} eth
          </div>
        </div>
        <div className="flex flex-col items-center">
          <div
            className={`flex flex-row items-center ${isApproved && mintState === 'NOT_LIVE' && 'disabled'}  ${(mintState !== 'NOT_LIVE' && (selectedTokens.length + vaultAmount + FCFSAmount) <= 0) && 'disabled'}`}>
            <EnterDecorationBlack className="w-[33px]" />
            <button className="px-3" type="button" onClick={mintHandler}>
              <h1 className="text-black text-[64px]">
                {
                  mintState === 'NOT_LIVE' ?
                    (ravendaleTokens.length > 0 && !isApproved) ? "Approve" : "Confirm" :
                  (selectedTokens.length > 0 && !isApproved) ? "Approve & Confirm" : "Confirm"
                }
              </h1>
            </button>
            <EnterDecorationBlack className="rotate-180 w-[33px]" />
          </div>
        </div>
      </div>
    );
  // if () TODO: PUBLIC SALE
  else return (
    <div className="flex flex-col items-center max-w-[90vw] animation">
      <Palette />
      <br />
      {/* <h3 className="text-[20px] md:text-[40px] whitespace-nowrap">Congrats Dreamer!</h3> */}
      <div className="max-w-[100%] relative flex items-center text-center w-[800px]">
        <MintTotalBigBackdrop className="mx-auto" />
        <h2 className="absolute top-[5px] w-[100%] text-[38px] md:text-[64px] text-white whitespace-nowrap mx-auto">
          All Sold Out!
        </h2>
      </div>
    </div>
  )
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center">
      <img className="absolute h-[100vh] xl:h-[auto] m-auto min-w-[100vw] xl:min-w-[1200px]" src={EllipseGradient}
        alt="ellipse" />
      <video autoPlay className="w-full h-full object-cover object-center" loop muted playsInline>
        <source src={BG_VIDEO} type="video/mp4" />
      </video>
      <Menu />
      <div className="cover flex flex-col justify-center items-center">
        {step === 0 ? renderStep0() : renderStep1()}
      </div>
      <Footer />
    </div>
  );
}
