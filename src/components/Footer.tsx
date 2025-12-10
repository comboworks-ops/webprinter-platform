import { Link } from "react-router-dom";
import { Facebook, Instagram, Linkedin } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-[#111827] text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Column 1: Brand */}
          <div>
            <h3 className="text-xl font-heading font-bold mb-4">Webprinter.dk</h3>
            <p className="text-gray-300 text-sm">
              Din partner for professionelt tryk og storformat print.
              Kvalitet, hurtig levering og personlig service.
            </p>
          </div>

          {/* Column 2: Links */}
          <div>
            <h4 className="text-lg font-heading font-semibold mb-4">Links</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/produkter" className="text-gray-300 hover:text-white transition-colors text-sm">
                  Produkter
                </Link>
              </li>
              <li>
                <Link to="/prisberegner" className="text-gray-300 hover:text-white transition-colors text-sm">
                  Prisberegner
                </Link>
              </li>
              <li>
                <Link to="/kontakt" className="text-gray-300 hover:text-white transition-colors text-sm">
                  Kontakt
                </Link>
              </li>
              <li>
                <Link to="/om-os" className="text-gray-300 hover:text-white transition-colors text-sm">
                  Om os
                </Link>
              </li>
              <li>
                <Link to="/betingelser" className="text-gray-300 hover:text-white transition-colors text-sm">
                  Salgsbetingelser
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Contact */}
          <div>
            <h4 className="text-lg font-heading font-semibold mb-4">Kontakt</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>Telefon: <a href="tel:+4571991110" className="hover:text-white transition-colors">71 99 11 10</a></li>
              <li>Email: <a href="mailto:support@webprinter.dk" className="hover:text-white transition-colors">support@webprinter.dk</a></li>
              <li className="mt-4 flex gap-4">
                <a href="#" className="hover:text-white transition-colors" aria-label="Facebook">
                  <Facebook className="h-5 w-5" />
                </a>
                <a href="#" className="hover:text-white transition-colors" aria-label="Instagram">
                  <Instagram className="h-5 w-5" />
                </a>
                <a href="#" className="hover:text-white transition-colors" aria-label="LinkedIn">
                  <Linkedin className="h-5 w-5" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-8 text-center text-sm text-gray-400">
          <p>&copy; 2025 Webprinter.dk – Alle rettigheder forbeholdes</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
