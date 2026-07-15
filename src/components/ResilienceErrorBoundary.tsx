import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import { motion } from "motion/react";
import { logger } from "../core/utils/systemLogger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ResilienceErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("[Resilience] Uncaught UI Exception:", { error, errorInfo }, "ErrorBoundary");
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#0c0c10] flex items-center justify-center p-6 z-[9999]">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-[#111116] border border-zinc-800 rounded-2xl p-8 text-center shadow-2xl"
          >
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-rose-500" />
            </div>
            
            <h2 className="text-xl font-black text-zinc-100 uppercase tracking-tighter mb-2">
              SİSTEM KESİNTİSİ
            </h2>
            <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
              Uygulama katmanında beklenmedik bir hata oluştu. AI Orchestrator OS kararlılığı korumak için bu modülü izole etti.
            </p>

            <div className="bg-black/40 rounded-lg p-4 mb-8 text-left border border-zinc-800/50">
              <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1 tracking-widest">Hata Kaydı</p>
              <p className="text-[11px] font-mono text-rose-400 break-all">
                {this.state.error?.message || "Unknown Runtime Error"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-100 text-black rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
              >
                <RefreshCcw className="w-4 h-4" />
                Yeniden Yükle
              </button>
              <button
                onClick={() => window.location.href = "/"}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-900 text-zinc-300 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-zinc-800 border border-zinc-800 transition-colors"
              >
                <Home className="w-4 h-4" />
                Ana Sayfa
              </button>
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
