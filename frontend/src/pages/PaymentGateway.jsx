import React, { useState } from 'react';
import '../styles/PaymentGateway.css';

const PaymentGateway = () => {
  const [paymentState, setPaymentState] = useState('idle'); // idle, processing, success, failed
  const [selectedAmount, setSelectedAmount] = useState(25);
  const [customAmount, setCustomAmount] = useState('');
  const [rfidInput, setRfidInput] = useState('');
  const [userDetails, setUserDetails] = useState(null);

  const presetAmounts = [10, 25, 50, 100, 200];

  // Simulate RFID verification
  const handleRFIDVerify = () => {
    if (rfidInput.trim().length === 0) {
      alert('Please enter RFID UID');
      return;
    }

    // Mock user verification
    setUserDetails({
      id: 'USR001',
      name: 'Arun Kumar',
      hostelBlock: 'Hostel Block A',
      roomNo: 'A-204',
      balance: 250.5,
      todayUsage: 4.2,
      status: 'Active',
    });
  };

  // Simulate payment processing
  const handlePayment = async () => {
    if (!userDetails) {
      alert('Please verify RFID first');
      return;
    }

    const amount = customAmount ? parseInt(customAmount) : selectedAmount;

    if (amount <= 0) {
      alert('Please select a valid amount');
      return;
    }

    setPaymentState('processing');

    // Simulate payment gateway delay
    setTimeout(() => {
      setPaymentState('success');
      setTimeout(() => {
        setPaymentState('idle');
      }, 3000);
    }, 2000);
  };

  return (
    <div className="payment-gateway-container">
      <div className="payment-bg-gradient"></div>

      {/* Header */}
      <div className="payment-header">
        <h1 className="payment-title">💳 Smart Payment Gateway</h1>
        <p className="payment-subtitle">Secure RFID-Based Water Prepayment System</p>
      </div>

      <div className="payment-content">
        {/* Left Section - RFID & User Verification */}
        <div className="rfid-section">
          <div className="rfid-card">
            <h2 className="section-title-payment">🔐 RFID Verification</h2>

            <div className="rfid-input-group">
              <label htmlFor="rfid">RFID UID:</label>
              <input
                id="rfid"
                type="text"
                placeholder="Enter or scan RFID card..."
                value={rfidInput}
                onChange={(e) => setRfidInput(e.target.value)}
                className="rfid-input"
              />
              <button onClick={handleRFIDVerify} className="btn-verify">
                ✓ Verify RFID
              </button>
            </div>

            {/* User Details Display */}
            {userDetails && (
              <div className="user-details-card">
                <div className="user-header">
                  <div className="user-avatar">👤</div>
                  <div className="user-info">
                    <h3 className="user-name">{userDetails.name}</h3>
                    <p className="user-id">ID: {userDetails.id}</p>
                  </div>
                  <span className={`user-status ${userDetails.status.toLowerCase()}`}>
                    {userDetails.status}
                  </span>
                </div>

                <div className="user-details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Hostel Block</span>
                    <span className="detail-value">{userDetails.hostelBlock}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Room No.</span>
                    <span className="detail-value">{userDetails.roomNo}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Account Balance</span>
                    <span className="detail-value balance">₹{userDetails.balance.toFixed(2)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Today's Usage</span>
                    <span className="detail-value">{userDetails.todayUsage}L</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Section - Payment Processing */}
        <div className="payment-section">
          <div className="payment-card">
            <h2 className="section-title-payment">💰 Select Amount</h2>

            {/* Preset Amounts */}
            <div className="amount-buttons-group">
              {presetAmounts.map((amount) => (
                <button
                  key={amount}
                  onClick={() => {
                    setSelectedAmount(amount);
                    setCustomAmount('');
                  }}
                  className={`amount-btn ${selectedAmount === amount && customAmount === '' ? 'active' : ''}`}
                >
                  ₹{amount}
                </button>
              ))}
            </div>

            {/* Custom Amount */}
            <div className="custom-amount-group">
              <label htmlFor="custom">Custom Amount:</label>
              <input
                id="custom"
                type="number"
                placeholder="Enter custom amount..."
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="custom-amount-input"
              />
            </div>

            {/* Payment Summary */}
            <div className="payment-summary">
              <div className="summary-item">
                <span>Amount to Pay:</span>
                <span className="amount-text">
                  ₹{(customAmount ? parseInt(customAmount) : selectedAmount)}
                </span>
              </div>
              <div className="summary-item">
                <span>Water Quantity:</span>
                <span className="qty-text">
                  {(customAmount ? parseInt(customAmount) : selectedAmount) / 5}L
                </span>
              </div>
              <div className="summary-divider"></div>
              <div className="summary-item total">
                <span>Total:</span>
                <span className="total-text">
                  ₹{(customAmount ? parseInt(customAmount) : selectedAmount)}
                </span>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="payment-methods">
              <h3 className="methods-title">Select Payment Method:</h3>
              <div className="method-options">
                <button className="method-btn active">
                  <span className="method-icon">📱</span>
                  <span>Razorpay</span>
                </button>
                <button className="method-btn">
                  <span className="method-icon">💳</span>
                  <span>Card</span>
                </button>
                <button className="method-btn">
                  <span className="method-icon">🏦</span>
                  <span>Bank Transfer</span>
                </button>
              </div>
            </div>

            {/* Payment Status */}
            {paymentState === 'processing' && (
              <div className="payment-processing">
                <div className="spinner"></div>
                <p>Processing payment...</p>
              </div>
            )}

            {paymentState === 'success' && (
              <div className="payment-success">
                <div className="success-icon">✅</div>
                <p className="success-message">Payment Successful!</p>
                <p className="success-detail">Dispensing water in 3 seconds...</p>
              </div>
            )}

            {paymentState === 'idle' && (
              <button
                onClick={handlePayment}
                className="btn-pay"
                disabled={!userDetails || selectedAmount <= 0}
              >
                <span className="btn-pay-icon">💳</span>
                <span className="btn-pay-text">
                  Pay ₹{customAmount ? parseInt(customAmount) : selectedAmount}
                </span>
              </button>
            )}

            {/* Security Info */}
            <div className="security-info">
              <span className="security-icon">🔒</span>
              <span className="security-text">Payments secured by Razorpay HMAC-256</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="transaction-history-section">
        <h2 className="section-title-payment">📋 Recent Transactions</h2>
        <div className="transaction-table">
          <div className="table-header">
            <div className="table-cell">Time</div>
            <div className="table-cell">Amount</div>
            <div className="table-cell">Quantity</div>
            <div className="table-cell">Status</div>
            <div className="table-cell">Station</div>
          </div>
          <div className="table-body">
            {[
              { time: '2:45 PM', amount: 50, quantity: 10, status: 'Success', station: 'STN-001' },
              { time: '1:30 PM', amount: 25, quantity: 5, status: 'Success', station: 'STN-002' },
              { time: '12:15 PM', amount: 100, quantity: 20, status: 'Success', station: 'STN-001' },
              { time: '11:00 AM', amount: 25, quantity: 5, status: 'Success', station: 'STN-003' },
            ].map((txn, idx) => (
              <div key={idx} className="table-row">
                <div className="table-cell">{txn.time}</div>
                <div className="table-cell amount-cell">₹{txn.amount}</div>
                <div className="table-cell">{txn.quantity}L</div>
                <div className="table-cell">
                  <span className={`status-badge status-${txn.status.toLowerCase()}`}>
                    {txn.status}
                  </span>
                </div>
                <div className="table-cell">{txn.station}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentGateway;
