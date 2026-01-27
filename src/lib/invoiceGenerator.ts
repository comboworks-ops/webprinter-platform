import jsPDF from 'jspdf';

interface InvoiceData {
    invoiceNumber: string;
    orderNumber: string;
    date: Date;
    dueDate?: Date;
    customer: {
        name: string;
        email: string;
        phone?: string;
        address?: string;
        city?: string;
        zip?: string;
        country?: string;
        cvr?: string;
    };
    company: {
        name: string;
        address: string;
        city: string;
        zip: string;
        country: string;
        cvr: string;
        phone: string;
        email: string;
        bankName?: string;
        bankAccount?: string;
    };
    items: {
        description: string;
        quantity: number;
        unitPrice: number;
        total: number;
    }[];
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    currency: string;
    notes?: string;
    isPaid?: boolean;
    paidDate?: Date;
}

export function generateInvoicePDF(data: InvoiceData): jsPDF {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Colors
    const primaryColor: [number, number, number] = [41, 98, 255]; // Blue
    const textColor: [number, number, number] = [33, 33, 33];
    const grayColor: [number, number, number] = [128, 128, 128];

    let y = 20;

    // Header - Company name
    doc.setFontSize(24);
    doc.setTextColor(...primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.text(data.company.name, 20, y);

    // FAKTURA label
    doc.setFontSize(32);
    doc.setTextColor(...textColor);
    doc.text('FAKTURA', pageWidth - 20, y, { align: 'right' });

    y += 15;

    // Company details
    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    doc.setFont('helvetica', 'normal');
    doc.text(data.company.address, 20, y);
    doc.text(`Fakturanr: ${data.invoiceNumber}`, pageWidth - 20, y, { align: 'right' });
    y += 5;
    doc.text(`${data.company.zip} ${data.company.city}`, 20, y);
    doc.text(`Ordrenr: ${data.orderNumber}`, pageWidth - 20, y, { align: 'right' });
    y += 5;
    doc.text(`CVR: ${data.company.cvr}`, 20, y);
    doc.text(`Dato: ${formatDate(data.date)}`, pageWidth - 20, y, { align: 'right' });
    y += 5;
    doc.text(`Tlf: ${data.company.phone}`, 20, y);
    if (data.dueDate) {
        doc.text(`Forfald: ${formatDate(data.dueDate)}`, pageWidth - 20, y, { align: 'right' });
    }
    y += 5;
    doc.text(data.company.email, 20, y);

    y += 20;

    // Divider line
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(20, y, pageWidth - 20, y);

    y += 15;

    // Bill To section
    doc.setFontSize(10);
    doc.setTextColor(...grayColor);
    doc.setFont('helvetica', 'bold');
    doc.text('FAKTURERES TIL:', 20, y);

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.setFontSize(11);
    doc.text(data.customer.name, 20, y);
    y += 5;

    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    if (data.customer.address) {
        doc.text(data.customer.address, 20, y);
        y += 5;
    }
    if (data.customer.zip || data.customer.city) {
        doc.text(`${data.customer.zip || ''} ${data.customer.city || ''}`.trim(), 20, y);
        y += 5;
    }
    doc.text(data.customer.email, 20, y);
    if (data.customer.phone) {
        y += 5;
        doc.text(data.customer.phone, 20, y);
    }
    if (data.customer.cvr) {
        y += 5;
        doc.text(`CVR: ${data.customer.cvr}`, 20, y);
    }

    y += 20;

    // Items table header
    const tableStartY = y;
    const colX = {
        description: 20,
        quantity: 100,
        unitPrice: 130,
        total: pageWidth - 20,
    };

    // Header background
    doc.setFillColor(245, 245, 245);
    doc.rect(20, y - 5, pageWidth - 40, 10, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text('Beskrivelse', colX.description, y);
    doc.text('Antal', colX.quantity, y);
    doc.text('Stk. pris', colX.unitPrice, y);
    doc.text('Beløb', colX.total, y, { align: 'right' });

    y += 10;

    // Items
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    for (const item of data.items) {
        doc.setTextColor(...textColor);
        doc.text(item.description, colX.description, y);
        doc.text(item.quantity.toString(), colX.quantity, y);
        doc.text(formatCurrency(item.unitPrice, data.currency), colX.unitPrice, y);
        doc.text(formatCurrency(item.total, data.currency), colX.total, y, { align: 'right' });
        y += 8;
    }

    y += 5;

    // Divider
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(100, y, pageWidth - 20, y);

    y += 10;

    // Totals section
    const totalsX = 130;
    const totalsValueX = pageWidth - 20;

    doc.setFontSize(10);
    doc.setTextColor(...grayColor);
    doc.text('Subtotal:', totalsX, y);
    doc.setTextColor(...textColor);
    doc.text(formatCurrency(data.subtotal, data.currency), totalsValueX, y, { align: 'right' });

    y += 8;
    doc.setTextColor(...grayColor);
    doc.text(`Moms (${data.taxRate}%):`, totalsX, y);
    doc.setTextColor(...textColor);
    doc.text(formatCurrency(data.taxAmount, data.currency), totalsValueX, y, { align: 'right' });

    y += 10;

    // Total line
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(totalsX - 10, y - 3, pageWidth - 20, y - 3);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text('Total:', totalsX, y + 5);
    doc.setTextColor(...primaryColor);
    doc.text(formatCurrency(data.total, data.currency), totalsValueX, y + 5, { align: 'right' });

    y += 25;

    // Payment status
    if (data.isPaid) {
        doc.setFillColor(34, 197, 94); // Green
        doc.roundedRect(20, y, 50, 12, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('BETALT', 45, y + 8, { align: 'center' });
        if (data.paidDate) {
            doc.setTextColor(...grayColor);
            doc.setFont('helvetica', 'normal');
            doc.text(`Betalt d. ${formatDate(data.paidDate)}`, 75, y + 8);
        }
        y += 20;
    }

    // Bank details
    if (data.company.bankName && data.company.bankAccount) {
        y += 10;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textColor);
        doc.text('Betalingsoplysninger:', 20, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);
        doc.text(`Bank: ${data.company.bankName}`, 20, y);
        y += 5;
        doc.text(`Konto: ${data.company.bankAccount}`, 20, y);
    }

    // Notes
    if (data.notes) {
        y += 15;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textColor);
        doc.text('Bemærkninger:', 20, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);
        const splitNotes = doc.splitTextToSize(data.notes, pageWidth - 40);
        doc.text(splitNotes, 20, y);
    }

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.text('Tak for din ordre!', pageWidth / 2, footerY, { align: 'center' });

    return doc;
}

function formatDate(date: Date): string {
    return date.toLocaleDateString('da-DK', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
}

function formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('da-DK', {
        style: 'currency',
        currency: currency,
    }).format(amount);
}

export function downloadInvoice(data: InvoiceData, filename?: string) {
    const doc = generateInvoicePDF(data);
    doc.save(filename || `Faktura-${data.invoiceNumber}.pdf`);
}

export function getInvoiceBlob(data: InvoiceData): Blob {
    const doc = generateInvoicePDF(data);
    return doc.output('blob');
}
