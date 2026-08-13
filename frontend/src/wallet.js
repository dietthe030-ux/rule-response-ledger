export const STUDIO_CHAIN = {
  chainId: "0xf22f",
  chainName: "Genlayer Studio Network",
  nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
  rpcUrls: ["https://studio.genlayer.com/api"],
  blockExplorerUrls: ["https://explorer-studio.genlayer.com"],
};

export function providerKey(detail) {
  const info = detail.info || {};
  return info.uuid || info.rdns || info.name || "legacy-provider";
}

export function collectProvider(map, detail) {
  if (!detail?.provider?.request) return map;
  if ([...map.values()].some((existing) => existing.provider === detail.provider)) return map;
  const key = providerKey(detail);
  if (!map.has(key)) map.set(key, detail);
  return map;
}

export function discoverProviders(onChange) {
  const providers = new Map();
  const announce = (event) => {
    collectProvider(providers, event.detail);
    onChange([...providers.values()]);
  };
  window.addEventListener("eip6963:announceProvider", announce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  const legacy = window.ethereum;
  const legacyProviders = legacy?.providers || (legacy ? [legacy] : []);
  legacyProviders.forEach((provider, index) => collectProvider(providers, {
    info: {
      uuid: `legacy-${index}-${provider.isMetaMask ? "metamask" : "wallet"}`,
      name: provider.isMetaMask ? "MetaMask" : `Browser wallet ${index + 1}`,
      rdns: provider.isMetaMask ? "io.metamask" : `legacy.${index}`,
    },
    provider,
  }));
  onChange([...providers.values()]);
  return () => window.removeEventListener("eip6963:announceProvider", announce);
}

export async function connectSelectedProvider(detail) {
  const accounts = await detail.provider.request({ method: "eth_requestAccounts" });
  if (!Array.isArray(accounts) || !accounts[0]) throw new Error("Wallet returned no account.");
  await ensureStudionet(detail.provider);
  return { address: accounts[0], provider: detail.provider, info: detail.info };
}

export async function ensureStudionet(provider) {
  const current = await provider.request({ method: "eth_chainId" });
  if (current?.toLowerCase() === STUDIO_CHAIN.chainId) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: STUDIO_CHAIN.chainId }] });
  } catch (error) {
    if (error?.code !== 4902 && error?.code !== -32603) throw error;
    await provider.request({ method: "wallet_addEthereumChain", params: [STUDIO_CHAIN] });
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: STUDIO_CHAIN.chainId }] });
  }
}

export function watchProvider(provider, onState) {
  const accountsChanged = (accounts) => onState({
    type: accounts?.[0] ? "account" : "disconnect",
    address: accounts?.[0] || null,
  });
  const chainChanged = (chainId) => onState({
    type: chainId?.toLowerCase() === STUDIO_CHAIN.chainId ? "studionet" : "wrong-chain",
    chainId,
  });
  const disconnected = () => onState({ type: "disconnect", address: null });
  provider.on?.("accountsChanged", accountsChanged);
  provider.on?.("chainChanged", chainChanged);
  provider.on?.("disconnect", disconnected);
  return () => {
    provider.removeListener?.("accountsChanged", accountsChanged);
    provider.removeListener?.("chainChanged", chainChanged);
    provider.removeListener?.("disconnect", disconnected);
  };
}
