"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Building2, ShieldCheck, MapPin, BookOpen, ChevronRight, ChevronLeft } from "lucide-react";

export default function LandingPage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      image: "/images/slider_farm_1791029747716.jpg",
      title: "Mapping the Future of Agriculture",
      description: "Securing agricultural land rights to foster economic growth and sustainable farming across East Africa."
    },
    {
      image: "/images/slider_office_1791029681335.jpg",
      title: "Verified & Transparent",
      description: "Our dedicated professionals ensure every record is rigorously verified against source documents."
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-teal-200">
      {/* Navigation */}
      <nav className="fixed w-full z-50 transition-all duration-300 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-forest-deep group">
            <div className="bg-forest-deep text-lime p-2 rounded-xl group-hover:scale-105 transition-transform">
              <Building2 size={24} strokeWidth={2} />
            </div>
            <div>
              <div className="font-bold tracking-tight text-lg leading-tight">Groundwork</div>
              <div className="text-[10px] font-semibold tracking-widest text-teal uppercase">Land Registry</div>
            </div>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="hidden md:block text-sm font-medium text-slate-600 hover:text-teal transition-colors">
              Registry Dashboard
            </Link>
            <Link
              href="/login"
              className="group relative inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-forest-deep rounded-full overflow-hidden hover:bg-forest transition-colors shadow-lg hover:shadow-xl hover:-translate-y-0.5 duration-300"
            >
              <span>Access Workspace</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/hero_landscape_1791029658916.jpg"
            alt="Beautiful Ugandan landscape"
            fill
            className="object-cover object-center opacity-15 saturate-[0.8]"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50/80 via-slate-50/95 to-slate-50"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal/10 text-teal text-sm font-semibold mb-6 animate-fade-in-up">
              <ShieldCheck size={16} />
              <span>Secure Digital Registry</span>
            </div>
            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-forest-deep mb-8 leading-[1.1]">
              Every parcel. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal to-lime">
                A record you can trust.
              </span>
            </h1>
            <p className="text-lg lg:text-xl text-slate-600 mb-10 max-w-2xl leading-relaxed">
              Groundwork is modernizing land administration in Uganda. One considered place for people, parcels, and the paper trail that connects them.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/login" className="inline-flex justify-center items-center gap-2 px-8 py-4 text-base font-semibold text-forest-deep bg-lime rounded-full hover:bg-[#b5da6c] transition-colors shadow-lg hover:shadow-xl">
                Enter Registry
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Marquee Section */}
      <div className="bg-forest-deep text-lime py-4 overflow-hidden flex whitespace-nowrap border-y border-forest">
        <div className="animate-marquee inline-block font-semibold tracking-widest text-sm">
          SECURE ENCRYPTION &nbsp; • &nbsp; VERIFIED PAPER TRAILS &nbsp; • &nbsp; MODERN INFRASTRUCTURE &nbsp; • &nbsp; AUDITED ACCESS &nbsp; • &nbsp; NATIONAL COVERAGE &nbsp; • &nbsp; SECURE ENCRYPTION &nbsp; • &nbsp; VERIFIED PAPER TRAILS &nbsp; • &nbsp; MODERN INFRASTRUCTURE &nbsp; • &nbsp; AUDITED ACCESS &nbsp; • &nbsp; NATIONAL COVERAGE &nbsp; • &nbsp;
        </div>
      </div>

      {/* Features */}
      <section className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-forest-deep mb-4">Built for Transparency</h2>
            <p className="text-slate-600">Our platform bridges the gap between physical books and digital accessibility, ensuring every record is immutable and verified.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: BookOpen, title: "Source-First Verification", desc: "Every digital record requires a verified scan of the original physical book before it is marked complete." },
              { icon: MapPin, title: "National Coverage", desc: "Browse records intuitively by district, county, sub-county, and village with our geographical tagging." },
              { icon: ShieldCheck, title: "Audited Administrator Access", desc: "Strict Two-Factor Authentication and detailed logging for every change made by registry officials." }
            ].map((feature, i) => (
              <div key={i} className="bg-slate-50 p-8 rounded-3xl border border-slate-100 hover:shadow-xl hover:border-teal/20 transition-all duration-300 group">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-teal shadow-sm mb-6 group-hover:scale-110 group-hover:bg-teal group-hover:text-white transition-all">
                  <feature.icon size={26} />
                </div>
                <h3 className="text-xl font-bold text-forest-deep mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Image Slider Section */}
      <section className="py-24 bg-slate-900 text-white overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">Preserving heritage, enabling growth.</h2>
              <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                By digitizing land records, we empower communities with unquestionable proof of ownership, unlocking agricultural investment and preventing disputes.
              </p>

              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentSlide(prev => (prev === 0 ? slides.length - 1 : prev - 1))}
                  className="w-12 h-12 rounded-full border border-slate-700 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  onClick={() => setCurrentSlide(prev => (prev + 1) % slides.length)}
                  className="w-12 h-12 rounded-full border border-slate-700 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
            </div>

            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl">
              {slides.map((slide, index) => (
                <div
                  key={index}
                  className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? "opacity-100" : "opacity-0"}`}
                >
                  <Image
                    src={slide.image}
                    alt={slide.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8">
                    <h3 className="text-2xl font-bold text-white mb-2">{slide.title}</h3>
                    <p className="text-slate-200">{slide.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 relative overflow-hidden bg-forest-deep text-center">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-teal/20 blur-3xl rounded-full scale-[2] translate-y-1/2"></div>
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-6">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">Ready to access the registry?</h2>
          <p className="text-teal-100 text-lg mb-10">Authorized administrators can sign in to view, edit, and verify land records.</p>
          <Link href="/login" className="inline-flex justify-center items-center gap-2 px-10 py-5 text-lg font-bold text-forest-deep bg-lime rounded-full hover:bg-white transition-colors shadow-2xl hover:scale-105 duration-300">
            Sign In to Workspace
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-white">
            <Building2 size={20} />
            <span className="font-bold tracking-tight">Groundwork</span>
          </div>
          <div className="text-sm">
            © {new Date().getFullYear()} Groundwork Uganda Land Registry. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Custom Styles for Marquee */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }

          .animate-marquee {
            animation: marquee 20s linear infinite;
            min-width: 200%;
          }

          @keyframes fade-in-up {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
          }

          .animate-fade-in-up {
            animation: fade-in-up 0.8s ease-out forwards;
          }
        `,
      }} />
    </div>
  );
}
